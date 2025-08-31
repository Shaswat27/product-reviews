/* src/scripts/seed.ts
   Seeds Supabase with mock data, aligned to PRD + Tech Setup schemas.

   Requirements:
   - Env vars in your shell (do NOT commit):
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   - Files present:
     /data/mock_products.json
     /data/mock_reviews.json
     /data/mock_themes.json
     /data/mock_actions.json
     /data/mock_insights.json
     /data/mock_trends.json

   Run:
     pnpm add -D tsx
     pnpm tsx src/scripts/seed.ts
*/

import { createClient } from "@supabase/supabase-js";
import { readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

type UUID = string;

// type MockProduct = { id: string; name: string; slug: string };
type MockReview = {
  id: string;
  product_id: string;
  source: string;
  rating?: number;
  review_date?: string; // ISO
  body: string;
  meta?: Record<string, unknown>;
};
type MockTheme = {
  id: string; // e.g., "t-notion-1"
  product_id: string;
  name: string;
  severity: "low" | "medium" | "high";
  trend?: number;
  evidence_count?: number;
  summary?: string;
};
type MockAction = {
  id: string;
  theme_id: string; // references MockTheme.id
  type: "product" | "gtm";
  description: string;
  impact_score?: number;
  effort_score?: number;
};
type MockInsight = {
  id: string;
  product_id: string;
  title?: string;
  summary?: string;
  date: string; // ISO date → insight_reports.week_start
};
type MockTrend = {
  product_id: string;
  week: string; // ISO date (week start)
  themes: number; // count
};

// Supabase table shapes per Tech Setup / Action Plan
// reviews(id uuid default, product_id text, source text, rating int, review_date date, body text, meta jsonb)
// review_embeddings(review_id uuid, embedding vector(1536))
// themes(id uuid default, product_id text, name text, severity enum, trend numeric, evidence_count int, summary text)
// actions(id uuid default, theme_id uuid, kind enum, description text, impact int, effort int, evidence jsonb)
// insight_reports(id uuid default, product_id text, week_start date, summary text, themes jsonb)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---- Utilities ----
const toUUID = () => crypto.randomUUID();

function safeDate(d?: string): string | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
}

function chunk<T>(arr: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadJson<T>(file: string): Promise<T> {
  const full = path.resolve(process.cwd(), "src", "data", file);
  const raw = await readFile(full, "utf8");
  return JSON.parse(raw) as T;
}

function assertEnv() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to your shell/terminal before running."
    );
  }
}

// ---- Main seed ----
async function main() {
  assertEnv();
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("Loading mock files from /data ...");
  const [
    reviews,
    themes,
    actions,
    insights,
    trends,
  ] = await Promise.all([
    loadJson<MockReview[]>("mock_reviews.json"),
    loadJson<MockTheme[]>("mock_themes.json"),
    loadJson<MockAction[]>("mock_actions.json"),
    loadJson<MockInsight[]>("mock_insights.json"),
    loadJson<MockTrend[]>("mock_trends.json").catch(() => []),
  ]);

  // Validation-lite checks against PRD expectations
  if (!reviews?.length) throw new Error("mock_reviews.json is empty.");
  if (!themes?.length) throw new Error("mock_themes.json is empty.");
  if (!actions?.length) throw new Error("mock_actions.json is empty.");
  if (!insights?.length) throw new Error("mock_insights.json is empty.");

  // Create ID maps to preserve relationships while using UUIDs in DB
  const themeIdMap = new Map<string, UUID>(); // old theme.id -> new uuid
  const actionIdMap = new Map<string, UUID>(); // old action.id -> new uuid
  const reviewIdMap = new Map<string, UUID>(); // old review.id -> new uuid

  // ---- Insert reviews ----
  console.log(`Inserting ${reviews.length} reviews ...`);
  const reviewRows = reviews.map((r) => {
    const id = toUUID();
    reviewIdMap.set(r.id, id);
    return {
      id,
      product_id: r.product_id,
      source: r.source,
      rating: r.rating ?? null,
      review_date: safeDate(r.review_date),
      body: r.body,
      meta: r.meta ?? null,
    };
  });

  for (const group of chunk(reviewRows, 1000)) {
    const { error } = await supabase.from("reviews").insert(group);
    if (error) throw new Error(`Insert reviews failed: ${error.message}`);
  }

  // ---- Insert themes ----
  console.log(`Inserting ${themes.length} themes ...`);
  const themeRows = themes.map((t) => {
    const id = toUUID();
    themeIdMap.set(t.id, id);
    // Enforce enum compatibility: severity must be low/medium/high
    const severity =
      t.severity === "low" || t.severity === "medium" || t.severity === "high"
        ? t.severity
        : "medium";
    return {
      id,
      product_id: t.product_id,
      name: t.name,
      severity,
      trend: typeof t.trend === "number" ? t.trend : null,
      evidence_count: typeof t.evidence_count === "number" ? t.evidence_count : 0,
      summary: t.summary ?? null,
    };
  });

  for (const group of chunk(themeRows, 1000)) {
    const { error } = await supabase.from("themes").insert(group);
    if (error) throw new Error(`Insert themes failed: ${error.message}`);
  }

  // ---- Insert actions (rename fields per schema: type->kind, impact_score->impact, effort_score->effort) ----
  console.log(`Inserting ${actions.length} actions ...`);
  const actionRows = actions.map((a) => {
    const id = toUUID();
    actionIdMap.set(a.id, id);
    const themeUuid = themeIdMap.get(a.theme_id);
    if (!themeUuid) {
      throw new Error(
        `Action ${a.id} references missing theme ${a.theme_id}. Check mock_actions.json / mock_themes.json.`
      );
    }
    const kind = a.type === "product" || a.type === "gtm" ? a.type : "product";
    const impact =
      typeof a.impact_score === "number" ? a.impact_score : null;
    const effort =
      typeof a.effort_score === "number" ? a.effort_score : null;
    return {
      id,
      theme_id: themeUuid,
      kind,
      description: a.description,
      impact,
      effort,
      evidence: null as unknown, // placeholder (LLM Stage-2 populates later)
    };
  });

  for (const group of chunk(actionRows, 1000)) {
    const { error } = await supabase.from("actions").insert(group);
    if (error) throw new Error(`Insert actions failed: ${error.message}`);
  }

  // ---- Insert insight_reports
  // Map insights.date -> week_start; attach a compact themes JSON payload from mock_trends (PRD wants a weekly pulse) ----
  console.log(`Inserting ${insights.length} insight_reports ...`);
  const trendIndex = new Map<string, MockTrend>(); // key: `${product_id}|${week_start}`
  for (const tr of trends) {
    const wk = safeDate(tr.week);
    if (wk) trendIndex.set(`${tr.product_id}|${wk}`, tr);
  }

  const insightRows = insights.map((ir) => {
    const week_start = safeDate(ir.date);
    const key = week_start ? `${ir.product_id}|${week_start}` : "";
    const t = week_start ? trendIndex.get(key) : undefined;

    // Minimal, PRD-aligned JSON payload for the "themes" column
    // You can expand this later to hold named themes and WoW deltas.
    const themesJson =
      t?.themes != null
        ? { theme_count: t.themes }
        : null;

    return {
      id: toUUID(),
      product_id: ir.product_id,
      week_start, // date
      summary: ir.summary ?? null,
      themes: themesJson, // jsonb
    };
  });

  for (const group of chunk(insightRows, 1000)) {
    const { error } = await supabase.from("insight_reports").insert(group);
    if (error) throw new Error(`Insert insight_reports failed: ${error.message}`);
  }

  // (Optional) If you add a products table later, you can seed it here using `products`.

  console.log("✅ Seed complete.");
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});