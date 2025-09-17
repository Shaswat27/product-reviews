// src/lib/synthesize.ts
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const promptPath = path.resolve("src/prompts/synthesize.md");
const systemPrompt = fs.readFileSync(promptPath, "utf-8");

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const supabase = createClient(
  mustEnv("NEXT_PUBLIC_SUPABASE_URL"),
  mustEnv("SUPABASE_SERVICE_ROLE_KEY")
);

const client = new OpenAI({
  apiKey: mustEnv("OPENAI_API_KEY"),
});

// Synthesizes root causes + actions for a theme
export async function synthesizeTheme(theme: {
  theme_id: string;
  theme: string;
  summary: string;
  examples: Array<{ snippet: string; evidence: { type: string; id: string } }>;
}) {
  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text: systemPrompt,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `THEME INPUT:\n${JSON.stringify(theme, null, 2)}`,
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "synthesis",
        strict: false,
        schema: {
          type: "object",
          properties: {
            root_causes: {
              type: "array",
              description:
                "1–6 short hypotheses explaining why this theme occurs.",
              items: { type: "string" },
              minItems: 1,
              maxItems: 6,
            },
            actions: {
              type: "array",
              description: "3–5 recommended actions tied to the theme.",
              items: {
                type: "object",
                properties: {
                  kind: {
                    type: "string",
                    enum: ["product", "gtm"],
                  },
                  description: {
                    type: "string",
                    description: "Specific and testable recommendation.",
                  },
                  impact: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                  },
                  effort: {
                    type: "integer",
                    minimum: 1,
                    maximum: 5,
                  },
                  evidence: {
                    type: "array",
                    description:
                      "Evidence references (ids from input examples).",
                    items: { type: "string" },
                    minItems: 1,
                  },
                },
                required: [
                  "kind",
                  "description",
                  "impact",
                  "effort",
                  "evidence",
                ],
              },
              minItems: 3,
              maxItems: 5,
            },
          },
          required: ["root_causes", "actions"],
        },
      },
      verbosity: "low",
    },
    reasoning: {
      effort: "low",
      summary: "auto",
    },
    tools: [],
    store: true,
    include: ["reasoning.encrypted_content"],
    max_output_tokens: 2000,
  });

  const parsed = JSON.parse(response.output_text);

  // Insert actions with simple dedupe on (theme_id, lower(description))
  if (parsed.actions?.length) {
    // fetch existing descriptions once
    const { data: existing } = await supabase
      .from("actions")
      .select("description")
      .eq("theme_id", theme.theme_id);
    const seen = new Set((existing ?? []).map(r => r.description.trim().toLowerCase()));

    for (const action of parsed.actions) {
      const key = action.description.trim().toLowerCase();
      if (seen.has(key)) continue;
      await supabase.from("actions").insert({
        theme_id: theme.theme_id,
        kind: action.kind,
        description: action.description,
        impact: action.impact,
        effort: action.effort,
        evidence: action.evidence,
      });
    }
  }

  return parsed;
}