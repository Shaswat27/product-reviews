// /src/lib/extract.ts
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/* ---------- Zod schema ---------- */
const AspectEnum = z.enum([
  "pricing","onboarding","support","performance",
  "integrations","reporting","usability","reliability","feature_gap",
]);
const SentimentEnum = z.enum(["positive","neutral","negative"]);
const SeverityEnum  = z.enum(["low","medium","high"]);

export const ExtractedZ = z.object({
  aspects: z.array(z.object({
    aspect: AspectEnum,
    sentiment: SentimentEnum,
    severity: SeverityEnum,
    evidence: z.string().min(2),
  })).default([]),
  persona: z.object({
    company_size: z.enum(["1-10","11-50","51-200","200+"]).optional(),
    industry: z.string().min(2).max(80).optional(),
  }).partial().optional(),
});
export type Extracted = z.infer<typeof ExtractedZ>;

/* ---------- Client ---------- */
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
// Use the exact model id you provided
const MODEL = "claude-3-5-haiku-latest";

/* ---------- Prompt loader (from .md) ---------- */
let _systemCache: string | null = null;

/**
 * Loads src/prompts/extract.haiku.md and substitutes {{EXAMPLE_JSON}}.
 * If file not found in build env, falls back to an inlined minimal prompt.
 */
function getSystemPrompt(exampleJson: string): string {
  if (_systemCache) return _systemCache;
  const mdPath = new URL("../prompts/extract.haiku.md", import.meta.url);
  try {
    const raw = fs.readFileSync(mdPath, "utf-8"); // fs can take a URL
    _systemCache = raw.replace("{{EXAMPLE_JSON}}", exampleJson.trim());
    return _systemCache;
  } catch {
  // fallback if file not bundled
    _systemCache = `
  You extract SaaS review signals for product strategy and GTM.
  Return ONLY valid JSON matching schema exactly.
  Schema: {"aspects":[{"aspect":"pricing|onboarding|support|performance|integrations|reporting|usability|reliability|feature_gap","sentiment":"positive|neutral|negative","severity":"low|medium|high","evidence":"<short quote>"}],"persona":{"company_size":"1-10|11-50|51-200|200+","industry":"<optional>"}}
  Example: ${exampleJson}
  Return ONLY JSON.`.trim();
  return _systemCache;
  }
}

/* ---------- User prompt ---------- */
function userPrompt(reviewChunk: string, meta?: unknown): string {
  // Keep this minimal; all instructions live in system prompt
  return [
    `Review chunk:`,
    reviewChunk,
    ``,
    `Meta (optional):`,
    JSON.stringify(meta ?? {}, null, 2),
  ].join("\n");
}

/* ---------- Chunking ---------- */
const MAX_CHARS = 6000;
function chunkText(s: string, max = MAX_CHARS) {
  if (s.length <= max) return [s];
  const chunks: string[] = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(i + max, s.length);
    const slice = s.slice(i, end);
    const pivot = slice.lastIndexOf(". ");
    const cut = pivot > max * 0.6 ? i + pivot + 2 : end;
    chunks.push(s.slice(i, cut));
    i = cut;
  }
  return chunks;
}

/* ---------- Haiku call with JSON mode + “{” priming ---------- */
type ExtractCallOpts = {
  exampleJson?: string; // allows caller to override example
};

async function callHaiku(input: string, meta?: unknown, opts?: ExtractCallOpts) {
  // Default example JSON (you can override via opts.exampleJson)
  const defaultExample = `{"aspects":[{"aspect":"pricing","sentiment":"negative","severity":"medium","evidence":"tiers are confusing"}]}`;
  const exampleJson = (opts?.exampleJson ?? process.env.EXTRACT_EXAMPLE_JSON ?? defaultExample);

  const systemPrompt = getSystemPrompt(exampleJson);
  const userText = userPrompt(input, meta);

  // 👇 Debug logs
  console.log("=== extract.ts Anthropic call ===");
  console.log("SYSTEM PROMPT:\n", systemPrompt);
  console.log("USER PROMPT:\n", userText);
  console.log("================================");

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0,
    system: getSystemPrompt(exampleJson),
    messages: [
      { role: "user",      content: [{ type: "text", text: userPrompt(input, meta) }] },
      // The assistant "{" primer nudges JSON-only completions
      { role: "assistant", content: [{ type: "text", text: "{" }] },
    ],
  });

  const text = res.content?.[0]?.type === "text" ? res.content[0].text : "";
  // The API often returns the full object even if we primed with "{"
  // If the first char is missing due to priming, fix up naïvely.
  const candidate = text.startsWith("{") ? text : `{${text}`;

  let json: unknown;
  try {
    json = JSON.parse(candidate);
  } catch (e) {
    console.warn("[extract] JSON parse failed. Raw:", text);
    json = {};
  }
  const parsed = ExtractedZ.safeParse(json);
  if (!parsed.success) {
    console.warn("[extract] Zod validation failed:", parsed.error?.flatten?.() ?? parsed.error);
    return { aspects: [], persona: undefined } as Extracted;
  }
  return parsed.data;
}

/* ---------- Merge logic ---------- */
type Aspect = Extracted["aspects"][number];
type AspectName = Aspect["aspect"];
const severityRank: Record<Aspect["severity"], number> = { low: 1, medium: 2, high: 3 };
const sentimentRank: Record<Aspect["sentiment"], number> = { negative: 3, neutral: 2, positive: 1 };

function mergeAspects(aspectLists: Aspect[][]): Aspect[] {
  const bucket = new Map<AspectName, Aspect>();
  for (const list of aspectLists) {
    for (const a of list) {
      const existing = bucket.get(a.aspect);
      if (!existing) {
        bucket.set(a.aspect, a);
      } else {
        const sentiment =
          sentimentRank[a.sentiment] > sentimentRank[existing.sentiment] ? a.sentiment : existing.sentiment;
        const severity =
          severityRank[a.severity] > severityRank[existing.severity] ? a.severity : existing.severity;
        const evidence = (a.evidence?.length ?? 0) > (existing.evidence?.length ?? 0)
          ? a.evidence
          : existing.evidence;
        bucket.set(a.aspect, { aspect: a.aspect, sentiment, severity, evidence: evidence?.slice(0, 300) });
      }
    }
  }
  // Drop only weak positives if you want; keep others
  return [...bucket.values()].filter(a => !(a.severity === "low" && a.sentiment === "positive"));
}

function mergePersona(items: Extracted[]): Extracted["persona"] | undefined {
  const out: Record<string, string | undefined> = {};
  for (const it of items) {
    if (!it.persona) continue;
    if (it.persona.company_size && !out.company_size) out.company_size = it.persona.company_size;
    if (it.persona.industry && !out.industry) out.industry = it.persona.industry;
  }
  return Object.keys(out).length ? (out as Extracted["persona"]) : undefined;
}

/* ---------- Public API ---------- */
export async function extractFromReview(
  review: { body: string; meta?: unknown },
  opts?: ExtractCallOpts
): Promise<Extracted> {
  const chunks = chunkText(review.body);
  const results = await Promise.all(chunks.map(c => callHaiku(c, review.meta, opts)));
  const aspects = mergeAspects(results.map(r => r.aspects));
  const persona = mergePersona(results);
  return ExtractedZ.parse({ aspects, persona }); // final validate
}