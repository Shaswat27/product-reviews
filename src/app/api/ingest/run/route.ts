/* eslint-disable no-console */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { readFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { embedTextBatch } from "@/lib/embeddings";
import Anthropic from "@anthropic-ai/sdk";
import { labelClusterTheme, type LabeledTheme } from "@/lib/themes";
import { type Severity, type EvidenceReview, explainEvidence, buildThemeDraft } from "@/lib/evidence";
import { synthesizeTheme } from "@/lib/synthesize";

const PROMPT_VERSION = 1 as const; // bump to invalidate LLM caches (Day-17)

// Evidence selection defaults
const EVIDENCE_K_DEFAULT = 5 as const;

// ---------- Constants ----------
const EMB_MODEL = "text-embedding-3-small" as const;
const CLU_EPS = 0.12 as const;     // fixed per D16 plan (tune if needed)
const CLU_MINPTS = 2 as const;     // fixed per D16 plan
const INCLUDE_NOISE_AS_SINGLETONS = true as const;

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
function toNumberArraySafe(v: unknown): number[] | null {
  if (Array.isArray(v) && typeof v[0] === "number") return v as number[];
  if (ArrayBuffer.isView(v) && typeof (v as any).length === "number") {
    return Array.from(v as Float32Array | Float64Array);
  }
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (Array.isArray(parsed) && typeof parsed[0] === "number") return parsed as number[];
    } catch { /* ignore */ }
  }
  if (v && typeof v === "object" && "data" in (v as any)) {
    const d = (v as any).data;
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

type RunIngestionOpts = { debug?: "emb" | "clu" | "ev"};

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

// ---------- Mock review loader (swap with TP proxy later) ----------
async function fetchReviewsForQuarter(
  productId: string,
  start: Date,
  end: Date,
  limit: number,
): Promise<Review[]> {
  const filePath = path.join(process.cwd(), "src", "data", "mock_reviews.json");
  const raw = await readFile(filePath, "utf8");
  const json = JSON.parse(raw) as Array<{
    id?: string;
    product_id: string;
    body: string;
    review_date?: string;
  }>;

  const filtered = json.filter((r) => {
    if (r.product_id !== productId) return false;
    const d = new Date(r.review_date ?? 0);
    return d >= start && d <= end;
  });

  const sorted = filtered
    .map((r) => {
      const id = r.id ?? sha256Str(`${r.product_id}:${r.body}`);
      const normalized_body = normalizeForSha(r.body);
      return {
        id,
        product_id: r.product_id,
        body: r.body,
        review_date: r.review_date ?? new Date(0).toISOString(),
        normalized_body,
        body_sha: sha256Str(normalized_body),
        source_url: undefined,
        // Optional severity for evidence weighting; default "medium" elsewhere if unset
      } satisfies Review;
    })
    .sort((a, b) => {
      if (a.product_id !== b.product_id) return a.product_id.localeCompare(b.product_id);
      if (a.review_date !== b.review_date) return a.review_date.localeCompare(b.review_date);
      return a.id.localeCompare(b.id);
    });

  return sorted.slice(0, limit);
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

  const result: Record<string, number[]> = {};
  for (const row of data ?? []) {
    const coerced = toNumberArraySafe((row as any).embedding);
    if (coerced) result[(row as any).body_sha] = coerced;
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

  // Final sanity log
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
  const c = new Array(dim).fill(0);
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
      const q = queue.shift()!;
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

  // Canonical order already enforced upstream (product_id:date:id); keep parallel arrays
  const items: Item[] = reviews.map((r, i) => ({ idx: i, id: r.id, body_sha: r.body_sha!, vec: vectors[i] }));
  const labels = dbscanDeterministic(items, CLU_EPS, CLU_MINPTS);

  const by: Map<number, number[]> = new Map();
  labels.forEach((lab, i) => {
    if (lab < 0) return; // skip noise for now
    const arr = by.get(lab) ?? [];
    arr.push(i);
    by.set(lab, arr);
  });

  const clusters = Array.from(by.entries()).map(([lab, idxs]) => {
  const c = centroid(idxs, items);
  const c6 = roundVector(c, 6);
  const id = clusterIdFromCentroid6(c6);
  return { id, size: idxs.length, centroid6: c6, memberIdxs: idxs };
  });

// NEW: deterministically convert noise to singleton clusters for debug
  if (INCLUDE_NOISE_AS_SINGLETONS) {
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] < 0) {
        const v6 = roundVector(items[i].vec, 6);
        const id = clusterIdFromCentroid6(v6);
        clusters.push({ id, size: 1, centroid6: v6, memberIdxs: [i] });
      }
    }
  }

  // Stable sort for output determinism
  clusters.sort((a, b) => a.id.localeCompare(b.id));
  return { clusters, items };
}

// ---------- Adapter: call labelClusterTheme using the picked evidence ----------
// Feeds your themes.ts prompt with a minimal Extracted-map built from evidence.
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

const DEFAULT_THEME_PROMPT =
  "You are a concise product ops assistant. Given sample quotes and top aspects, return a short theme name, a 1–2 sentence summary, and severity. Output strict JSON.";

async function llmNameAndSummarizeUsingThemes(
  _centroid6: readonly number[],
  evidence: ReadonlyArray<EvidenceReview>,
  {
    productId,
    clusterId,
    promptTemplate = DEFAULT_THEME_PROMPT,
    anthropicApiKey = process.env.ANTHROPIC_API_KEY,
  }: { productId: string; clusterId: string; promptTemplate?: string; anthropicApiKey?: string },
): Promise<{ name: string; summary: string; severity: Severity }> {
  if (!anthropicApiKey) {
    // Deterministic fallback when key missing
    return { name: "Theme (stub)", summary: "Summary (stub)", severity: "medium" };
  }
  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  // Minimal deterministic stand-in for Stage-1 extracts using evidence quotes.
  const extractedByReviewId = new Map<string, Extracted>();
  for (const r of evidence) {
    const quote = (r.body ?? "").trim().slice(0, 180);
    extractedByReviewId.set(r.id, {
      aspects: [{
        aspect: "usability",
        sentiment: "neutral",
        // EvidenceReview currently has no severity; default to medium
        severity: (r as any).severity ?? "medium",
        evidence: quote,
      }],
    });
  }
  const labeled: LabeledTheme = await labelClusterTheme({
    anthropic,
    promptTemplate,
    productId,
   clusterId,
    reviewIds: evidence.map(e => e.id),
   extractedByReviewId,
    maxQuotes: 6,
  });
  return { name: labeled.name, summary: labeled.summary, severity: labeled.severity };
}

// ---------- Pipeline ----------
async function runIngestion(input: Required<IngestBody>, opts?: RunIngestionOpts) {
  const { businessUnitId, quarter, limit } = input;

  const { start, end } = await resolveQuarterRange(quarter);
  const manifestId = crypto.randomUUID(); // keep this

  const { error: manErr } = await db
  .from("manifests")
  .insert({
      id: manifestId,                     // UUID you just generated
      business_unit_id: businessUnitId,   // matches your schema
      quarter,                            // "2025Q3"
      start_date: start.toISOString(),    // or start (if column is date, cast server-side)
      end_date: end.toISOString(),
      pipeline_version: PIPELINE_VERSION,
  });
  if (manErr) throw manErr;

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
      step: "emb",
      usedModel: EMB_MODEL,
      count: vectors.length,
      dim,
      samplePreview: previewVec(sample, 8),
      sampleHash: vecHash6(sample),
    };
  }

  const { clusters, items } = await clusterDeterministic(vectors, reviews);

  if (opts?.debug === "clu") {
    // compact cluster info for debugging
    const out = clusters.map((c) => ({
      id: c.id,
      size: c.size,
      centroidPreview: c.centroid6.slice(0, 8),
      memberIds: c.memberIdxs.map((i) => items[i].body_sha).slice(0, 10),
    }));
    return { step: "clu", clusters: out };
  }

  // ---------- Evidence selection + Theme draft wiring ----------
  // Use the same reviews array as EvidenceReview[] (compatible subset)
  const reviewsForEvidence: EvidenceReview[] = reviews.map((r) => ({
    id: r.id,
    body: r.body ?? "",
    review_date: r.review_date,
    // If you later add r.severity, it will be picked up automatically
  }));

  // Build drafts per cluster with deterministic picks
  const themes = [];
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

  // ⬇️ NEW: persist theme as cache + source of truth (and get UUID)
  const topic_key = c.id.replace(/^cl_/, "");
  const { data: themeRow, error: themeErr } = await db
    .from("themes")
    .upsert({
      product_id: businessUnitId,
      manifest_id: manifestId,            // ✅ FK now valid
      cluster_id: c.id,
      topic_key: c.id.replace(/^cl_/, ""),
      prompt_version: PROMPT_VERSION,
      evidence_count: draft.evidence_ids.length,
      name: draft.name,
      summary: draft.summary,
      severity: draft.severity,
    }, { onConflict: "cluster_id" })
    .select("id, cluster_id")          
    .single();
  if (themeErr) throw themeErr;

  themes.push(draft);

  // Save the UUID on the draft object so we can use it for actions
  (draft as any)._theme_uuid = themeRow.id;
  }

  // Optional debug for evidence selection
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
    return { step: "ev", clusters: debugClusters };
  }

  // ---------- Day 17: Actions synthesis (cache-first inside synthesizeTheme) ----------
  // For each theme draft, build examples[] deterministically from the chosen evidence
  const byId = new Map(reviewsForEvidence.map(r => [r.id, r]));

  for (const t of themes) {
    const examples = t.evidence_ids
      .map(id => byId.get(id))
      .filter((r): r is EvidenceReview => !!r)
      .map(r => ({
        snippet: (r.body ?? "").trim().slice(0, 180),
        evidence: { type: "review", id: r.id },
      }));

    const themeUuid = (t as any)._theme_uuid as string; // from step 1

    await synthesizeTheme({
      theme_id: themeUuid,        // ✅ UUID that matches themes.id
      theme: t.name,
      summary: t.summary,
      examples,
    });
  }

  return {
    ok: true,
    processed: reviews.length,
    unit: businessUnitId,
    quarter,
    manifestId,
    themes, // same shape you already return
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