// src/lib/synthesize.ts
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { PROMPT_VERSION } from "@/lib/cache";
import {withTransportRetry} from "@/lib/retry";
import { supabaseServerRead } from "@/lib/supabaseServerRead";
import OpenAI from "openai";
import { z } from "zod";

const ActionsSchema = z.object({
  root_causes: z.array(z.string()).min(1).max(6),
  actions: z.array(z.object({
    kind: z.enum(["product","gtm"]),
    description: z.string().min(5),
    impact: z.number().int().min(1).max(5),
    effort: z.number().int().min(1).max(5),
    evidence: z.array(z.string()).min(1),
  })).min(3).max(5),
});


function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function getSynthesizePrompt(): Promise<string> {
  const mdPath = path.join(process.cwd(), "src/prompts/synthesize.md");
  return fs.readFile(mdPath, "utf8");
}

const supabase = createClient(
  mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
  mustEnv("SUPABASE_SERVICE_ROLE_KEY")
);

const client = new OpenAI({
  apiKey: mustEnv("OPENAI_API_KEY"),
});

export async function getActionsCacheFromActions(themeId: string) {
  const s = await supabaseServerRead();
  const { data, error } = await s
    .from("actions")
    .select("drafts")
    .eq("theme_id", themeId)
    .eq("description", "__cache__")
    .eq("prompt_version", PROMPT_VERSION)
    .maybeSingle();
  if (error) throw error;
  return data?.drafts ?? null;
}

async function upsertRealActions(
  themeUuid: string,
  actions: Array<{ kind: "product"|"gtm"; description: string; impact: number; effort: number; evidence: string[] }>
) {
  if (!actions?.length) return;

  const { data: existing } = await supabase
    .from("actions")
    .select("description")
    .eq("theme_id", themeUuid)
    .neq("description", "__cache__");

  const seen = new Set((existing ?? []).map(r => r.description.trim().toLowerCase()));

  for (const a of actions) {
    const key = a.description.trim().toLowerCase();
    if (seen.has(key)) continue;

    await supabase.from("actions").insert({
      theme_id: themeUuid,
      kind: a.kind,
      description: a.description,
      impact: a.impact,
      effort: a.effort,
      evidence: a.evidence,
      prompt_version: PROMPT_VERSION,
    });
    seen.add(key);
  }
}

// CHANGED: Added productId to the function signature.
export async function synthesizeTheme(theme: {
  theme_id: string;
  theme: string;
  summary: string;
  examples: Array<{ snippet: string; evidence: { type: string; id: string } }>;
  productId: string;
}) {
  const cached = await getActionsCacheFromActions(theme.theme_id);
  if (cached) {
    const parsed = ActionsSchema.parse(cached);
    await upsertRealActions(theme.theme_id, parsed.actions);
    return parsed;
  }

  // CHANGED: Prepend product name to the prompt.
  const baseSystemPrompt = await getSynthesizePrompt();
  const systemPrompt = `Do this for ${theme.productId}.\n\n${baseSystemPrompt}`;

  const response = await withTransportRetry(() => client.responses.create({
    model: "gpt-5-mini",
    input: [
      { role: "developer", content: [{ type: "input_text", text: systemPrompt }] },
      { role: "user",      content: [{ type: "input_text", text: `THEME INPUT:\n${JSON.stringify(theme, null, 2)}` }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "synthesis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["root_causes", "actions"],
          properties: {
            root_causes: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
            actions: {
              type: "array",
              minItems: 3,
              maxItems: 5,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["kind","description","impact","effort","evidence"],
                properties: {
                  kind: { type: "string", enum: ["product","gtm"] },
                  description: { type: "string" },
                  impact: { type: "integer", minimum: 1, maximum: 5 },
                  effort: { type: "integer", minimum: 1, maximum: 5 },
                  evidence: { type: "array", items: { type: "string" }, minItems: 1 },
                }
              }
            }
          }
        },
      },
      verbosity: "low",
    },
    reasoning: { effort: "low", summary: "auto" },
    tools: [],
    store: true,
    include: ["reasoning.encrypted_content"],
    max_output_tokens: 2000,
  }));

  const parsed = ActionsSchema.parse(JSON.parse(response.output_text));

  await setActionsCacheInActions(theme.theme_id, parsed);

  await upsertRealActions(theme.theme_id, parsed.actions);

  return parsed;
}


export async function setActionsCacheInActions(themeId: string, blob: unknown) {
  const { error } = await supabase.from("actions").upsert(
    {
      theme_id: themeId,
      kind: "product",
      description: "__cache__",
      impact: 1,
      effort: 1,
      evidence: [],
      prompt_version: PROMPT_VERSION,
      drafts: blob,
    },
    { onConflict: "theme_id,description" }
  );
  if (error) throw error;
}