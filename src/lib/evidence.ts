// src/lib/evidence.ts
/* eslint-disable no-console */
// Deterministic evidence selection (TF–IDF × severity × recency)
// and Theme Draft wiring (LLM stub passed in by caller).
// ESLint strict-friendly, pure functions, stable ordering.

export type Severity = "low" | "medium" | "high";

export interface EvidenceReview {
  readonly id: string;
  readonly body: string;
  readonly review_date: string; // ISO string
  readonly severity?: Severity; // optional; default treated as "medium"
}

export interface EvidenceScore {
  readonly reviewId: string;
  readonly score: number;
  readonly tfidfSum: number;
  readonly recency: number;
  readonly severityWeight: number;
}

export interface ClusterForDraft {
  readonly id: string;                 // "cl_abcdef123456"
  readonly centroid6: readonly number[]; // rounded 6dp
  readonly memberIdxs: readonly number[]; // indices into the reviews array given to buildThemeDraft
}

export interface ThemeDraft {
 readonly cluster_id: string;
  readonly topic_key: string;          // cluster_id without "cl_"
  readonly evidence_ids: readonly string[];
  readonly name: string;
  readonly summary: string;
  readonly severity: Severity;
}

export const severityWeight: Readonly<Record<Severity, number>> = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

const STOPWORDS: ReadonlySet<string> = new Set(
  [
    "a","an","and","are","as","at","be","but","by","for","if","in","into","is","it",
    "no","not","of","on","or","such","that","the","their","then","there","these","they",
    "this","to","was","will","with","we","you","your","our","from","have","has","had",
  ],
);

function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}
function tokenize(text: string): string[] {
  const norm = normalizeText(text);
  const raw = norm.split(/[^\p{L}\p{N}]+/u);
  const out: string[] = [];
  for (const tok of raw) {
    if (tok.length < 2) continue;
    if (STOPWORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

export function recencyWeight(reviewDateISO: string, clusterEnd: Date): number {
  const t = Date.parse(reviewDateISO);
  if (Number.isNaN(t)) return 0.1; // conservative if bad date
  const daysSince = (clusterEnd.getTime() - t) / (1000 * 60 * 60 * 24);
  const maxDays = 90; // quarter length
  const w = 1 - daysSince / maxDays;
  return Math.max(0.1, Math.min(1, w));
}

function clusterEndDate(members: readonly EvidenceReview[]): Date {
  let maxTime = 0;
  for (const m of members) {
    const t = Date.parse(m.review_date);
    if (!Number.isNaN(t) && t > maxTime) maxTime = t;
  }
  return new Date(maxTime || 0);
}

function computeTfIdfSumPerDoc(members: readonly EvidenceReview[]): Record<string, number> {
  const df: Record<string, number> = Object.create(null);
  const docTokens: Record<string, string[]> = Object.create(null);

  for (const r of members) {
    const toks = tokenize(r.body ?? "");
    const uniq = Array.from(new Set(toks)).sort();
    for (const term of uniq) df[term] = (df[term] ?? 0) + 1;
    docTokens[r.id] = toks;
  }

  const N = Math.max(1, members.length);
  const idf: Record<string, number> = Object.create(null);
  for (const term of Object.keys(df).sort()) {
    const d = df[term] ?? 0;
    idf[term] = Math.log((N + 1) / (d + 1)) + 1;
  }

  const perDoc: Record<string, number> = Object.create(null);
  for (const r of members) {
    const toks = docTokens[r.id] ?? [];
    if (toks.length === 0) { perDoc[r.id] = 0; continue; }
    const tf: Record<string, number> = Object.create(null);
    for (const t of toks) tf[t] = (tf[t] ?? 0) + 1;
    let sum = 0;
    const denom = toks.length;
    for (const term of Object.keys(tf).sort()) {
      sum += (tf[term] / denom) * (idf[term] ?? 0);
    }
    perDoc[r.id] = Math.round(sum * 1e12) / 1e12;
  }
  return perDoc;
}

export function scoreEvidence(
  members: readonly EvidenceReview[],
  clusterEnd?: Date,
): Readonly<Record<string, EvidenceScore>> {
  const end = clusterEnd ?? clusterEndDate(members);
  const tfidf = computeTfIdfSumPerDoc(members);
  const out: Record<string, EvidenceScore> = Object.create(null);
  for (const r of members) {
    const sev = (r.severity ?? "medium") as Severity;
    const sevW = severityWeight[sev] ?? 1;
    const recW = recencyWeight(r.review_date, end);
    const base = tfidf[r.id] ?? 0;
    const total = Math.round(Math.max(0, base * sevW * recW) * 1e12) / 1e12;
    out[r.id] = { reviewId: r.id, score: total, tfidfSum: base, recency: recW, severityWeight: sevW };
  }
  return out;
}

export function pickEvidenceDeterministic(
  members: readonly EvidenceReview[],
  k = 5,
  clusterEnd?: Date,
): EvidenceReview[] {
  if (members.length === 0) return [];
  const scores = scoreEvidence(members, clusterEnd);
  const sorted = members.slice().sort((a, b) => {
    const sa = scores[a.id]?.score ?? 0;
    const sb = scores[b.id]?.score ?? 0;
    if (sa !== sb) return sb - sa; // score DESC
    if (a.review_date !== b.review_date) return a.review_date.localeCompare(b.review_date); // ASC
    return a.id.localeCompare(b.id); // ASC
  });
  const limit = Math.min(Math.max(0, k), sorted.length);
  return sorted.slice(0, limit);
}

export function explainEvidence(
  members: readonly EvidenceReview[],
  k = 5,
  clusterEnd?: Date,
): Array<{
  id: string;
  review_date: string;
  severity: Severity;
  score: number;
  tfidfSum: number;
  recency: number;
  severityWeight: number;
}> {
  const end = clusterEnd ?? clusterEndDate(members);
  const scores = scoreEvidence(members, end);
  const picks = pickEvidenceDeterministic(members, k, end);
  return picks.map((r) => ({
    id: r.id,
    review_date: r.review_date,
    severity: (r.severity ?? "medium") as Severity,
    score: scores[r.id]?.score ?? 0,
    tfidfSum: scores[r.id]?.tfidfSum ?? 0,
    recency: scores[r.id]?.recency ?? 0,
    severityWeight: scores[r.id]?.severityWeight ?? 1,
  }));
}

export async function buildThemeDraft(
  cluster: ClusterForDraft,
  reviews: readonly EvidenceReview[],
  k: number,
  llmNameAndSummarize: (
    centroid6: readonly number[],
    evidence: ReadonlyArray<EvidenceReview>,
  ) => Promise<{ name: string; summary: string; severity: Severity }>,
): Promise<ThemeDraft> {
  const members = cluster.memberIdxs.map((i) => reviews[i]);
  const evidence = pickEvidenceDeterministic(members, k);
  const { name, summary, severity } = await llmNameAndSummarize(cluster.centroid6, evidence);
  return {
    cluster_id: cluster.id,
    topic_key: cluster.id.replace(/^cl_/, ""),
    evidence_ids: evidence.map((e) => e.id),
    name,
    summary,
    severity,
  };
}