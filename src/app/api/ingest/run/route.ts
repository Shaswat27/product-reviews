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
import { type Severity, type EvidenceReview, explainEvidence, buildThemeDraft } from "@/lib/evidence";
import { synthesizeTheme } from "@/lib/synthesize";
import { fetchNormalizedTrustpilot, extractDomainFromTarget } from "@/lib/trustpilot/normalize";
import { extractFromReview, type Extracted as ExtractedFromLib } from "@/lib/extract";

const PROMPT_VERSION = 1 as const; // bump to invalidate LLM caches (Day-17)

// Evidence selection defaults
const EVIDENCE_K_DEFAULT = 5 as const;

// ---------- Constants ----------
const EMB_MODEL = "text-embedding-3-small" as const;
const CLU_EPS = Number(process.env.CLUSTER_EPS ?? 0.14);
const CLU_MINPTS = Number(process.env.CLUSTER_MINPTS ?? 10);
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
function previewVec(vec: number[] | undefined, dims = 8): number[] | null {
  if (!Array.isArray(vec) || vec.length === 0) return null;
  return vec.slice(0, Math.min(dims, vec.length));
}
function vecHash6(vec: number[] | undefined): string | null {
  if (!Array.isArray(vec)) return null;
  const json = JSON.stringify(vec);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
}
function normalizeForSha(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}
function sha256Str(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

// Coerce any Supabase vector-ish shape -> number[]
function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function hasNumberLength(x: unknown): x is { length: number } {
  return isRecord(x) && typeof (x as { length?: unknown }).length === "number";
}

function toNumberArraySafe(v: unknown): number[] | null {
  // 1) Already a number[]
  if (Array.isArray(v) && typeof v[0] === "number") return v as number[];

  // 2) Typed arrays (Float32Array, Float64Array, Int32Array, etc.)
  // ArrayBufferView includes DataView (no length), so refine to array-like
  if (ArrayBuffer.isView(v) && hasNumberLength(v)) {
    // At this point, v is something like a TypedArray with numeric indices
    // Cast via unknown -> ArrayLike<number> to satisfy TS without widening to any
    return Array.from(v as unknown as ArrayLike<number>);
  }

  // 3) JSON stringified vector
  if (typeof v === "string") {
    try {
      const parsed: unknown = JSON.parse(v);
      if (Array.isArray(parsed) && typeof parsed[0] === "number") return parsed as number[];
    } catch { /* ignore */ }
  }

  // 4) Objects like { data: number[] }
  if (isRecord(v) && "data" in v) {
    const d = (v as { data?: unknown }).data;
    if (Array.isArray(d) && typeof d[0] === "number") return d as number[];
  }

  return null;
}

// ---------- Types ----------
type IngestBody = {
  businessUnitId: string;
  quarter: string; // e.g. 2025Q3
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

// Supabase row helpers
type ReviewTextEmbeddingRow = { body_sha: string; embedding: unknown };
type ThemeRowShort = { id: string; cluster_id: string };

// Draft type returned by buildThemeDraft
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
  if (typeof b.quarter !== "string" || !/^\d{4}Q[1-4]$/.test(b.quarter)) {
    throw new Error("`quarter` must be like 2025Q3");
  }
  if (b.limit !== undefined && (!Number.isInteger(b.limit) || (b.limit as number) <= 0)) {
    throw new Error("`limit` must be a positive integer");
  }
}

// ---------- Quarter helpers ----------
async function resolveQuarterRange(quarter: string): Promise<{ start: Date; end: Date }> {
  const year = Number(quarter.slice(0, 4));
  const q = Number(quarter.slice(5));
  const startMonths = { 1: 0, 2: 3, 3: 6, 4: 9 } as const;
  const m = startMonths[q as 1 | 2 | 3 | 4];
  const start = new Date(Date.UTC(year, m, 1));
  const end = new Date(Date.UTC(year, m + 3, 0));
  return { start, end };
}

async function fetchReviewsForQuarter(
  productIdOrDomain: string,
  start: Date,
  end: Date,
  limit: number,
): Promise<Review[]> {
  // derive quarter string from the provided start date (your runner already has it)
  const quarter = `${start.getUTCFullYear()}Q${Math.floor(start.getUTCMonth() / 3) + 1}`;
  const target = extractDomainFromTarget(productIdOrDomain);

  const { items } = await fetchNormalizedTrustpilot(target, quarter, limit);

  const mapped: Review[] = items
    .filter((it) => {
      const d = new Date(`${it.review_date}T00:00:00Z`);
      return d >= start && d <= end;
    })
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

  // keep your canonical sort for determinism
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

// ---------- Embedding runner (deterministic) ----------
async function embedDeterministic(texts: string[], hashes: string[]): Promise<number[][]> {
  if (texts.length !== hashes.length) {
    throw new Error(`texts.length (${texts.length}) !== hashes.length (${hashes.length})`);
  }
  if (texts.length === 0) return [];

  console.log("emb:cache.request", { model: EMB_MODEL, count: hashes.length, first5: hashes.slice(0, 5) });
  const cached = await getCachedEmbeddings(hashes, EMB_MODEL);
  console.log("emb:cache.resultFirst5", Object.keys(cached).slice(0, 5));

  const toEmbedIdx: number[] = [];
  const out: number[][] = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) {
    const h = hashes[i];
    const v = cached[h];
    if (v && v.length > 0) {
      out[i] = roundVector(v, 6);
      console.log("emb:source", { idx: i, body_sha: h, source: "cache", preview: out[i].slice(0, 8) });
    } else {
      toEmbedIdx.push(i);
    }
  }

  if (toEmbedIdx.length > 0) {
    const batchTexts = toEmbedIdx.map((i) => texts[i]);
    console.log("emb:api.request", { count: batchTexts.length });
    const fresh = await embedTextBatch(batchTexts); // L2-normalized by lib
    const freshRounded = fresh.map((v) => roundVector(v, 6));

    const rows = toEmbedIdx.map((i, k) => ({
      body_sha: hashes[i],
      embedding: freshRounded[k],
    }));
    await putCachedEmbeddings(rows, EMB_MODEL);

    toEmbedIdx.forEach((i, k) => {
      out[i] = freshRounded[k];
      console.log("emb:source", { idx: i, body_sha: hashes[i], source: "api", preview: out[i].slice(0, 8) });
    });
  }

  for (let i = 0; i < Math.min(2, out.length); i++) {
    console.log("emb:final.idxRow", { idx: i, body_sha: hashes[i], vecPreview: out[i]?.slice(0, 8) });
  }
  return out;
}

// ---------- Deterministic clustering (DBSCAN on rounded vectors) ----------
type Item = { idx: number; id: string; body_sha: string; vec: number[] };

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
function cosineDist(a: number[], b: number[]): number {
  return 1 - dot(a, b);
}
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

function dbscanDeterministic(items: Item[], eps: number, minPts: number): number[] {
  const n = items.length;
  const labels = new Array<number>(n).fill(-99); // -99 = unvisited, -1 = noise, >=0 = cluster
  let cid = 0;

  const neigh: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    const nb: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = cosineDist(items[i].vec, items[j].vec);
      if (d <= eps) nb.push(j);
    }
    nb.sort((p, q) => {
      const A = items[p], B = items[q];
      if (A.body_sha !== B.body_sha) return A.body_sha < B.body_sha ? -1 : 1;
      return A.id.localeCompare(B.id);
    });
    neigh[i] = nb;
  }

  for (let i = 0; i < n; i++) {
    if (labels[i] !== -99) continue;
    const N = neigh[i];
    if (N.length + 1 < minPts) { labels[i] = -1; continue; }
    const my = cid++;
    labels[i] = my;
    const queue: number[] = [i, ...N];
    while (queue.length) {
      const q = queue.shift() as number;
      if (labels[q] === -1) labels[q] = my;
      if (labels[q] !== -99) continue;
      labels[q] = my;
      const Nq = neigh[q];
      if (Nq.length + 1 >= minPts) {
        for (const j of Nq) if (labels[j] === -99 || labels[j] === -1) queue.push(j);
      }
    }
  }
  return labels;
}

async function clusterDeterministic(vectors: number[][], reviews: Review[]): Promise<{
  clusters: Array<{ id: string; size: number; centroid6: number[]; memberIdxs: number[] }>;
  items: Item[];
}> {
  if (vectors.length !== reviews.length) throw new Error("vectors/reviews length mismatch");

  const items: Item[] = reviews.map((r, i) => ({ idx: i, id: r.id, body_sha: r.body_sha!, vec: vectors[i] }));
  const labels = dbscanDeterministic(items, CLU_EPS, CLU_MINPTS);

  const by: Map<number, number[]> = new Map();
  labels.forEach((lab, i) => {
    if (lab < 0) return; // skip noise for now
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

  // Convert noise to singleton clusters for debug determinism
  if (INCLUDE_NOISE_AS_SINGLETONS) {
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] < 0) {
        const v6 = roundVector(items[i].vec, 6);
        const id = clusterIdFromCentroid6(v6);
        clusters.push({ id, size: 1, centroid6: v6, memberIdxs: [i] });
      }
    }
  }

  clusters.sort((a, b) => a.id.localeCompare(b.id));
  return { clusters, items };
}

// ---------- Adapter: call labelClusterTheme using the picked evidence ----------
type AspectName =
  | "pricing" | "onboarding" | "support" | "performance"
  | "integrations" | "reporting" | "usability" | "reliability" | "feature_gap";

type Extracted = {
  aspects: Array<{
    aspect: AspectName;
    sentiment: "positive" | "neutral" | "negative";
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
  persona?: { company_size?: "1-10" | "11-50" | "51-200" | "200+"; industry?: string };
};

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

  // Load canonical theme-labeling prompt when not provided
  const effectivePrompt =
    promptTemplate ??
    (await fs.readFile(
      path.join(process.cwd(), "src", "prompts", "theme-labeling.md"),
      "utf8",
    ));

  // Build the extractedByReviewId map using your real extractor
  // Runs in parallel, then assembles the Map once all are done.
  const extractedPairs = await Promise.all(
    evidence.map(async (r) => {
      const body = String(r.body ?? "");
      // Pass any meta you want; extractor supports it (optional)
      const extracted: ExtractedFromLib = await extractFromReview({ body, meta: { review_id: r.id } });
      // Trim evidence for prompt hygiene (labeler will cap again)
      const trimmed: Extracted = {
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

  const extractedByReviewId = new Map<string, Extracted>(
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
  const { businessUnitId, quarter, limit } = input;

  const { start, end } = await resolveQuarterRange(quarter);
  // Look up by natural key first
const { data: existing, error: selErr } = await db
  .from("manifests")
  .select("id")
  .eq("business_unit_id", businessUnitId)
  .eq("quarter", quarter)
  .eq("pipeline_version", PIPELINE_VERSION)
  .maybeSingle();
if (selErr) throw selErr;

let manifestId: string;

if (existing?.id) {
  // Reuse the existing PK; update non-PK fields only
  manifestId = existing.id;
  const { error: updErr } = await db
    .from("manifests")
    .update({
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      // any other mutable columns EXCEPT id
    })
    .eq("id", manifestId);
  if (updErr) throw updErr;
} else {
  // Create a fresh row with a new id
  manifestId = crypto.randomUUID();
  const { error: insErr } = await db
    .from("manifests")
    .insert({
      id: manifestId,
      business_unit_id: businessUnitId,
      quarter,
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      pipeline_version: PIPELINE_VERSION,
    });
  if (insErr) throw insErr;
}

  const reviews = await fetchReviewsForQuarter(businessUnitId, start, end, limit);
  console.log("reviews fetched:", reviews.length, "range", start.toISOString(), end.toISOString(), "unit", businessUnitId);
  console.log("emb:inputFirst5", reviews.slice(0, 5).map((r) => r.body_sha));

  const texts = reviews.map((r) => (r.body ?? "").trim());
  const hashes = reviews.map((r) => r.body_sha ?? sha256Str(normalizeForSha(r.body)));

  const vectors = await embedDeterministic(texts, hashes);

  if (opts?.debug === "emb") {
    const dim = vectors.length ? vectors[0].length : 0;
    const sample = vectors[0];
    console.log("emb:firstVecPreview", previewVec(sample, 8));
    return {
      step: "emb" as const,
      usedModel: EMB_MODEL,
      count: vectors.length,
      dim,
      samplePreview: previewVec(sample, 8),
      sampleHash: vecHash6(sample),
    };
  }

  const { clusters, items } = await clusterDeterministic(vectors, reviews);

  if (opts?.debug === "clu") {
    const out = clusters.map((c) => ({
      id: c.id,
      size: c.size,
      centroidPreview: c.centroid6.slice(0, 8),
      memberIds: c.memberIdxs.map((i) => items[i].body_sha).slice(0, 10),
    }));
    return { step: "clu" as const, clusters: out };
  }

  // Evidence selection + Theme draft wiring
  const reviewsForEvidence: EvidenceReview[] = reviews.map((r) => ({
    id: r.id,
    body: r.body ?? "",
    review_date: r.review_date,
  }));

  // Build drafts per cluster deterministically
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

    // Persist theme and obtain UUID
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
    }, { onConflict: "manifest_id,cluster_id" })  // <- critical change
    .select("id, cluster_id")
    .single();
    if (themeErr) throw themeErr;

    const typedThemeRow = themeRow as ThemeRowShort;
    themes.push({ draft, uuid: typedThemeRow.id });
  }

  if (opts?.debug === "ev") {
    const debugClusters = clusters.map((c) => {
      const members = c.memberIdxs.map((i) => reviewsForEvidence[i]);
      return {
        id: c.id,
        size: c.size,
        centroidPreview: c.centroid6.slice(0, 8),
        evidence: explainEvidence(members, EVIDENCE_K_DEFAULT),
      };
    });
    return { step: "ev" as const, clusters: debugClusters };
  }

  // Actions synthesis — build examples[] deterministically from evidence
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
    });
  }

  return {
    ok: true as const,
    processed: reviews.length,
    unit: businessUnitId,
    quarter,
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
    quarter: body.quarter,
    limit: body.limit ?? 12,
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