import { z } from "zod";
import {PROMPT_VERSION} from "@/lib/cache"
import Anthropic from "@anthropic-ai/sdk";
import {supabaseServerRead} from "@/lib/supabaseServerRead";
import {withTransportRetry} from "@/lib/retry";
import { type Extracted } from "@/lib/extract";

type AspectName =
  | "pricing" | "onboarding" | "support" | "performance"
  | "integrations" | "reporting" | "usability" | "reliability" | "feature_gap";

export type LabeledTheme = {
  name: string;
  summary: string;
  severity: "low" | "medium" | "high";
  evidence_count: number;
};

const Output = z.object({
  name: z.string().min(2).max(80),
  summary: z.string().min(5).max(400),
  severity: z.enum(["low", "medium", "high"]),
});

const topK = <T extends string>(arr: T[], k: number) => {
  const freq = new Map<T, number>();
  for (const x of arr) freq.set(x, (freq.get(x) ?? 0) + 1);
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([x])=>x);
};

function majoritySeverity(ss: Array<"low"|"medium"|"high">): "low"|"medium"|"high" {
  const order = ["low", "medium", "high"] as const;
  const m = new Map<typeof order[number], number>(order.map(s => [s, 0]));
  ss.forEach(s => m.set(s, (m.get(s) ?? 0) + 1));
  return [...m.entries()].sort(
    (a,b)=>(b[1]-a[1]) || (order.indexOf(b[0]) - order.indexOf(a[0]))
  )[0][0];
}

function extractJson(s: string): string {
  return (s.match(/\{[\s\S]*\}$/)?.[0] ?? s).trim();
}
function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

function titleFromAspects(as: string[]): string | null {
  if (!as.length) return null;
  const m: Record<string,string> = {
    pricing: "Pricing clarity",
    onboarding: "Team onboarding",
    support: "Customer support",
    performance: "Performance issues",
    integrations: "Integrations",
    reporting: "Reporting & analytics",
    usability: "Usability",
    reliability: "Reliability",
    feature_gap: "Feature gaps",
  };
  return m[as[0]] ?? as[0].replace(/_/g, " ");
}

export async function getThemeFromTable(clusterId: string) {
  const s = await supabaseServerRead();
  const { data, error } = await s
    .from("themes")
    .select("id, name, summary, severity, evidence_count")
    .eq("cluster_id", clusterId)
    .eq("prompt_version", PROMPT_VERSION)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // null = cache miss
}

/**
 * Label a single cluster -> {name, summary, severity, evidence_count}
 * Accepts the minimal shape your cluster function returns once expanded.
 */
export async function labelClusterTheme(opts: {
  anthropic: Anthropic;
  promptTemplate: string;
  productId: string;
  clusterId: string | number;
  reviewIds: string[];
  extractedByReviewId: Map<string, Extracted>;
  maxQuotes?: number;
}): Promise<LabeledTheme> {
  const { anthropic, promptTemplate, productId, clusterId, reviewIds, extractedByReviewId, maxQuotes = 6 } = opts;

  const cached = await getThemeFromTable(String(clusterId));
  if (cached) {
    return {
      name: cached.name,
      summary: cached.summary,
      severity: cached.severity,
      evidence_count: cached.evidence_count ?? reviewIds.length,
    };
  }

  const aspects: AspectName[] = [];
  const severities: Array<"low"|"medium"|"high"> = [];
  const quotes: { id: string; quote: string }[] = [];

  for (const rid of reviewIds) {
    const ex = extractedByReviewId.get(rid);
    if (!ex) continue;
    for (const a of ex.aspects) {
      aspects.push(a.aspect);
      severities.push(a.severity);
      if (quotes.length < maxQuotes && a.evidence?.trim()) {
        quotes.push({ id: rid, quote: a.evidence.trim().slice(0, 180) });
      }
    }
  }

  const topAspects = topK(aspects, 5);
  const evidence_count = reviewIds.length;
  const fallbackSeverity = severities.length ? majoritySeverity(severities) : "medium";

  const userPayload = {
    product_id: productId,
    cluster_id: `${clusterId}`,
    top_aspects: topAspects,
    example_quotes: quotes,
    counts: { reviews_in_cluster: evidence_count },
  };

  console.log("=== labelClusterTheme Anthropic call ===");
  console.log("SYSTEM PROMPT:\n", promptTemplate);
  console.log("USER PROMPT:\n", JSON.stringify(userPayload, null, 2));
  console.log("========================================");

  const msg = await withTransportRetry(() => anthropic.messages.create({
    model: "claude-3-5-haiku-20241022",
    temperature: 0,
    max_tokens: 1000,
    system: promptTemplate,
    messages: [{ role: "user", content: [{ type: "text", text: JSON.stringify(userPayload) }] }],
    })
  );

  const raw = (msg.content?.[0] as { type: "text"; text: string } | undefined)?.text ?? "";
  const json = extractJson(raw);
  const parsed = Output.safeParse(safeParse(json));

  if (!parsed.success) {
    return {
      name: titleFromAspects(topAspects) ?? "Customer Theme",
      summary: `Theme derived from ${evidence_count} reviews focusing on ${topAspects.join(", ")}.`,
      severity: fallbackSeverity,
      evidence_count,
    };
  }

  return { ...parsed.data, evidence_count };
}

export async function upsertThemeCached(row: {
  manifest_id: string;
  product_id: string;
  cluster_id: string;
  topic_key: string;
  name: string;
  summary: string;
  severity: "low"|"medium"|"high";
  evidence_count: number;
}) {
  const s = await supabaseServerRead();
  const { error } = await s.from("themes").upsert(
    { ...row, prompt_version: PROMPT_VERSION },
    { onConflict: "cluster_id" } // adjust if your unique key differs
  );
  if (error) throw error;
}