/* eslint-disable no-console */
import { NextResponse } from "next/server";

import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { embedTextBatch } from "@/lib/embeddings";
import Anthropic from "@anthropic-ai/sdk";
import { labelClusterTheme, type LabeledTheme } from "@/lib/themes";
import { type Severity, type EvidenceReview, buildThemeDraft } from "@/lib/evidence";
import { synthesizeTheme } from "@/lib/synthesize";
import { fetchNormalizedTrustpilot, extractDomainFromTarget } from "@/lib/trustpilot/normalize";
import { extractFromReview, type Extracted as ExtractedFromLib } from "@/lib/extract";
import { HDBSCAN } from "hdbscan-ts";

const PROMPT_VERSION = 1 as const; // bump to invalidate LLM caches (Day-17)

// Evidence selection defaults
const EVIDENCE_K_DEFAULT = 5 as const;

// ---------- Constants ----------
const EMB_MODEL = "text-embedding-3-small" as const;
const CLU_MIN_CLUSTER_SIZE = Number(process.env.CLUSTER_MIN_CLUSTER_SIZE ?? 4);
const CLU_MIN_SAMPLES = Number(process.env.CLU_MIN_SAMPLES ?? 3);
const INCLUDE_NOISE_AS_SINGLETONS = false as const;

const PIPELINE_VERSION = "1.0.0" as const;

// ---------- Supabase ----------
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ---------- Utils ----------
function roundTo(v: number, places = 6): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}
function roundVector(vec: number[], places = 6): number[] {
  return vec.map((x) => roundTo(x, places));
}
function normalizeForSha(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}
function sha256Str(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function hasNumberLength(x: unknown): x is { length: number } {
  return isRecord(x) && typeof (x as { length?: unknown }).length === "number";
}

function toNumberArraySafe(v: unknown): number[] | null {
  if (Array.isArray(v) && typeof v[0] === "number") return v as number[];
  if (ArrayBuffer.isView(v) && hasNumberLength(v)) {
    return Array.from(v as unknown as ArrayLike<number>);
  }
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (Array.isArray(parsed) && typeof parsed[0] === "number") return parsed as number[];
    } catch { /* ignore */ }
  }
  if (isRecord(v) && "data" in v) {
    const d = (v as { data?: unknown }).data;
    if (Array.isArray(d) && typeof d[0] === "number") return d as number[];
  }
  return null;
}

// ---------- Types ----------
type IngestBody = {
  businessUnitId: string;
  limit?: number;
};

type Review = {
  id: string;
  product_id: string;
  body: string;
  review_date: string; // ISO
  normalized_body?: string;
  body_sha?: string;
  source_url?: string;
};

type RunIngestionOpts = { debug?: "emb" | "clu" | "ev" };

type ReviewTextEmbeddingRow = { body_sha: string; embedding: unknown };
type ThemeRowShort = { id: string; cluster_id: string };
type ThemeDraft = Awaited<ReturnType<typeof buildThemeDraft>>;

// ---------- Validation ----------
function badRequest(message: string) {
  return NextResponse.json({ error: "BadRequest", message }, { status: 400 });
}
function validate(body: unknown): asserts body is IngestBody {
  if (typeof body !== "object" || body === null) throw new Error("Body must be an object");
  const b = body as Record<string, unknown>;
  if (typeof b.businessUnitId !== "string" || b.businessUnitId.trim() === "") {
    throw new Error("`businessUnitId` is required (non-empty string)");
  }
  if (b.limit !== undefined && (!Number.isInteger(b.limit) || (b.limit as number) <= 0)) {
    throw new Error("`limit` must be a positive integer");
  }
}

// ---------- Review Fetching ----------
async function fetchRecentReviews(
  productIdOrDomain: string,
  limit: number,
): Promise<Review[]> {
  const target = extractDomainFromTarget(productIdOrDomain);

  const { items } = await fetchNormalizedTrustpilot(target, limit);

  const mapped: Review[] = items
    .map((it) => {
      const id = sha256Str(`${target}:${it.body_sha}:${it.review_date}`);
      return {
        id,
        product_id: target,
        body: it.body,
        review_date: `${it.review_date}T00:00:00.000Z`,
        normalized_body: it.normalized_body,
        body_sha: it.body_sha,
        source_url: it.source_url ?? undefined,
      } satisfies Review;
    });

  mapped.sort((a, b) => {
    if (a.product_id !== b.product_id) return a.product_id.localeCompare(b.product_id);
    if (a.review_date !== b.review_date) return a.review_date.localeCompare(b.review_date);
    return a.id.localeCompare(b.id);
  });

  return mapped.slice(0, limit);
}

// ---------- Embedding cache ----------
export async function getCachedEmbeddings(
  hashes: string[],
  model: string = EMB_MODEL,
): Promise<Record<string, number[]>> {
  if (hashes.length === 0) return {};
  const { data, error } = await db
    .from("review_text_embeddings")
    .select("body_sha, embedding")
    .eq("model", model)
    .in("body_sha", hashes);
  if (error) throw error;
  const rows = (data ?? []) as ReviewTextEmbeddingRow[];
  const result: Record<string, number[]> = {};
  for (const row of rows) {
    const coerced = toNumberArraySafe(row.embedding);
    if (coerced) result[row.body_sha] = coerced;
  }
  return result;
}

async function putCachedEmbeddings(
  rows: Array<{ body_sha: string; embedding: number[] }>,
  model: string = EMB_MODEL,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({ ...r, model }));
  const { error } = await db
    .from("review_text_embeddings")
    .upsert(payload, { onConflict: "body_sha,model", ignoreDuplicates: false });
  if (error) throw error;
}

// ---------- Embedding runner ----------
async function embedDeterministic(texts: string[], hashes: string[]): Promise<number[][]> {
  if (texts.length !== hashes.length) {
    throw new Error(`texts.length (${texts.length}) !== hashes.length (${hashes.length})`);
  }
  if (texts.length === 0) return [];

  const cached = await getCachedEmbeddings(hashes, EMB_MODEL);
  const toEmbedIdx: number[] = [];
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const h = hashes[i];
    const v = cached[h];
    if (v && v.length > 0) {
      out[i] = roundVector(v, 6);
    } else {
      toEmbedIdx.push(i);
    }
  }
  if (toEmbedIdx.length > 0) {
    const batchTexts = toEmbedIdx.map((i) => texts[i]);
    console.log("emb:api.request", { count: batchTexts.length });
    const fresh = await embedTextBatch(batchTexts);
    const freshRounded = fresh.map((v) => roundVector(v, 6));
    const rows = toEmbedIdx.map((i, k) => ({
      body_sha: hashes[i],
      embedding: freshRounded[k],
    }));
    await putCachedEmbeddings(rows, EMB_MODEL);
    toEmbedIdx.forEach((i, k) => {
      out[i] = freshRounded[k];
    });
  }
  return out;
}

// ---------- Deterministic clustering (HDBSCAN on rounded vectors) ----------
type Item = { idx: number; id: string; body_sha: string; vec: number[] };

function centroid(indices: number[], items: Item[]): number[] {
  const dim = items[0]?.vec.length ?? 0;
  const c = new Array(dim).fill(0) as number[];
  for (const i of indices) {
    const v = items[i].vec;
    for (let k = 0; k < dim; k++) c[k] += v[k];
  }
  const inv = 1 / indices.length;
  for (let k = 0; k < dim; k++) c[k] *= inv;
  return c;
}
function clusterIdFromCentroid6(c6: number[]): string {
  const h = sha256Str(JSON.stringify(c6));
  return `cl_${h.slice(0, 12)}`;
}

async function clusterDeterministic(vectors: number[][], reviews: Review[]): Promise<{
  clusters: Array<{ id: string; size: number; centroid6: number[]; memberIdxs: number[] }>;
  items: Item[];
}> {
  if (vectors.length === 0) {
    return { clusters: [], items: [] };
  }
  if (vectors.length !== reviews.length) throw new Error("vectors/reviews length mismatch");

  const items: Item[] = reviews.map((r, i) => ({ idx: i, id: r.id, body_sha: r.body_sha!, vec: vectors[i] }));
  
  console.log("Cluster minimum size: ", CLU_MIN_CLUSTER_SIZE)
  const clusterer = new HDBSCAN({ minClusterSize: CLU_MIN_CLUSTER_SIZE, minSamples: CLU_MIN_SAMPLES });
  const labels = clusterer.fit(vectors);

  const by: Map<number, number[]> = new Map();
  const noiseIndices: number[] = [];
  labels.forEach((lab: number, i: number) => {
    if (lab < 0) {
        noiseIndices.push(i);
        return;
    }
    const arr = by.get(lab) ?? [];
    arr.push(i);
    by.set(lab, arr);
  });

  const clusters = Array.from(by.entries()).map(([_, idxs]) => {
    const c = centroid(idxs, items);
    const c6 = roundVector(c, 6);
    const id = clusterIdFromCentroid6(c6);
    return { id, size: idxs.length, centroid6: c6, memberIdxs: idxs };
  });

  if (INCLUDE_NOISE_AS_SINGLETONS) {
    for (const i of noiseIndices) {
        const v6 = roundVector(items[i].vec, 6);
        const id = clusterIdFromCentroid6(v6);
        clusters.push({ id, size: 1, centroid6: v6, memberIdxs: [i] });
    }
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id));
  return { clusters, items };
}


// ---------- LLM Functions ----------
type AspectName =
  | "pricing" | "onboarding" | "support" | "performance"
  | "integrations" | "reporting" | "usability" | "reliability" | "feature_gap";

async function llmNameAndSummarizeUsingThemes(
  _centroid6: readonly number[],
  evidence: ReadonlyArray<EvidenceReview>,
  {
    productId,
    clusterId,
    promptTemplate,
    anthropicApiKey = process.env.ANTHROPIC_API_KEY,
  }: { productId: string; clusterId: string; promptTemplate?: string; anthropicApiKey?: string },
): Promise<{ name: string; summary: string; severity: Severity }> {
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for theme labeling");
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });
  const basePrompt =
    promptTemplate ??
    (await fs.readFile(
      path.join(process.cwd(), "src", "prompts", "theme-labeling.md"),
      "utf8",
    ));
  const effectivePrompt = `Do this for ${productId}.\n\n${basePrompt}`;

  const extractedPairs = await Promise.all(
    evidence.map(async (r) => {
      const body = String(r.body ?? "");
      const extracted: ExtractedFromLib = await extractFromReview({ body, meta: { review_id: r.id } }, { productId });
      const trimmed: ExtractedFromLib = {
        aspects: extracted.aspects.map(a => ({
          aspect: a.aspect as AspectName,
          sentiment: a.sentiment,
          severity: a.severity,
          evidence: String(a.evidence ?? "").trim().slice(0, 180),
        })),
        persona: extracted.persona,
      };
      return [r.id, trimmed] as const;
    })
  );

  const extractedByReviewId = new Map<string, ExtractedFromLib>(
    extractedPairs.filter(([, ex]) => ex.aspects.length > 0)
  );

  const labeled: LabeledTheme = await labelClusterTheme({
    anthropic,
    promptTemplate: effectivePrompt,
    productId,
    clusterId,
    reviewIds: evidence.map((e) => e.id),
    extractedByReviewId,
    maxQuotes: 6,
  });

  return { name: labeled.name, summary: labeled.summary, severity: labeled.severity as Severity };
}

// ---------- Pipeline ----------
async function runIngestion(input: Required<IngestBody>, opts?: RunIngestionOpts) {
  const { businessUnitId, limit } = input;
  
  // --- MODIFICATION START ---
  // 1. Determine the current quarter (e.g., "2025Q4")
  const now = new Date();
  const year = now.getUTCFullYear();
  const quarterNum = Math.floor(now.getUTCMonth() / 3) + 1;
  const currentQuarter = `${year}Q${quarterNum}`;

  // 2. Check if a manifest already exists for this quarter
  const { data: existingManifest } = await db
    .from("manifests")
    .select("id")
    .eq("business_unit_id", businessUnitId)
    .eq("timestamp", currentQuarter) // Check against the 'timestamp' column
    .maybeSingle();

  // 3. If it exists, exit early to prevent re-fetching
  if (existingManifest) {
    console.log(`Manifest for ${businessUnitId} in ${currentQuarter} already exists. Skipping.`);
    return {
      ok: false as const,
      message: `Ingestion for quarter ${currentQuarter} has already been processed.`,
      processed: 0,
      unit: businessUnitId,
      quarter: currentQuarter,
      manifestId: existingManifest.id,
      themes: [],
    };
  }
  // --- MODIFICATION END ---

  // 4. If no manifest exists, proceed with a new run
  const manifestId = crypto.randomUUID();
  const { error: insErr } = await db
    .from("manifests")
    .insert({
      id: manifestId,
      business_unit_id: businessUnitId,
      timestamp: currentQuarter, // Use the determined quarter name
      pipeline_version: PIPELINE_VERSION,
    });
  if (insErr) throw insErr;

  const reviews = await fetchRecentReviews(businessUnitId, limit);
  console.log("reviews fetched:", reviews.length, "unit", businessUnitId);

  const texts = reviews.map((r) => (r.body ?? "").trim());
  const hashes = reviews.map((r) => r.body_sha ?? sha256Str(normalizeForSha(r.body)));
  const vectors = await embedDeterministic(texts, hashes);

  if (opts?.debug === "emb") {
    return NextResponse.json(
      vectors.map((v, i) => ({ id: reviews[i].id, vec: v.slice(0, 8) })),
      { status: 200 },
    );
  }

  const { clusters } = await clusterDeterministic(vectors, reviews);

  if (opts?.debug === "clu") {
    return NextResponse.json(clusters, { status: 200 });
  }

  const reviewsForEvidence: EvidenceReview[] = reviews.map((r) => ({
    id: r.id,
    body: r.body ?? "",
    review_date: r.review_date,
  }));
  const themes: Array<{ draft: ThemeDraft; uuid: string }> = [];

  for (const c of clusters) {
    const draft = await buildThemeDraft(
      { id: c.id, centroid6: c.centroid6, memberIdxs: c.memberIdxs },
      reviewsForEvidence,
      EVIDENCE_K_DEFAULT,
      async (centroid6, evidence) =>
        llmNameAndSummarizeUsingThemes(centroid6, evidence, {
          productId: businessUnitId,
          clusterId: c.id,
        }),
    );
    const topic_key = c.id.replace(/^cl_/, "");
    const { data: themeRow, error: themeErr } = await db
    .from("themes")
    .upsert({
      product_id: businessUnitId,
      manifest_id: manifestId,
      cluster_id: c.id,
      topic_key,
      prompt_version: PROMPT_VERSION,
      evidence_count: draft.evidence_ids.length,
      name: draft.name,
      summary: draft.summary,
      severity: draft.severity,
    }, { onConflict: "manifest_id,cluster_id" })
    .select("id, cluster_id")
    .single();
    if (themeErr) throw themeErr;
    const typedThemeRow = themeRow as ThemeRowShort;
    themes.push({ draft, uuid: typedThemeRow.id });
  }

  if (opts?.debug === "ev") {
    return NextResponse.json(
      { themes: themes.map((t) => t.draft) },
      { status: 200 },
    );
  }

  const byId = new Map(reviewsForEvidence.map(r => [r.id, r]));
  for (const { draft, uuid } of themes) {
    const examples = draft.evidence_ids
      .map(id => byId.get(id))
      .filter((r): r is EvidenceReview => !!r)
      .map(r => ({
        snippet: (r.body ?? "").trim().slice(0, 180),
        evidence: { type: "review" as const, id: r.id },
      }));

    await synthesizeTheme({
      theme_id: uuid,
      theme: draft.name,
      summary: draft.summary,
      examples,
      productId: businessUnitId,
    });
  }

  return {
    ok: true as const,
    processed: reviews.length,
    unit: businessUnitId,
    quarter: currentQuarter, // Return the quarter name
    manifestId,
    themes: themes.map(t => t.draft),
  };
}

// ---------- Route ----------
export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production";
  const url = new URL(req.url);
  const rawDebug = url.searchParams.get("debug") ?? "";
  const debug = ((): "emb" | "clu" | "ev" | undefined => {
    if (rawDebug === "emb" || rawDebug === "clu" || rawDebug === "ev") return rawDebug;
    return undefined;
  })();

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    validate(json);
  } catch (e) {
    return badRequest((e as Error).message);
  }

  const body = json as IngestBody;
  const resolved: Required<IngestBody> = {
    businessUnitId: body.businessUnitId.trim(),
    limit: body.limit ?? 100,
  };

  console.log("POST /api/ingest/run ->", { ...resolved, debug });

  try {
    const result = await runIngestion(resolved, { debug });
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const err = e as Error;
    console.error("INGEST.RUN ERROR:", err);
    const payload = isProd
      ? { error: err.name || "Error", message: err.message }
      : { error: err.name || "Error", message: err.message, stack: err.stack };
    return NextResponse.json(payload, { status: 500 });
  }
}