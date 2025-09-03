// scripts/backfill-embeddings.ts
import "dotenv/config"; // optional if you run with --env-file
import { createClient } from "@supabase/supabase-js";
import { upsertReviewEmbeddings, ReviewForEmbedding } from "../lib/embeddings";

// If not using --env-file, force the .env.local path:
// import dotenv from "dotenv";
// dotenv.config({ path: ".env.local" });

console.log("OPENAI_API_KEY prefix:", process.env.OPENAI_API_KEY?.slice(0, 7));

function must(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

const url = must("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = must("SUPABASE_SERVICE_ROLE_KEY");
must("OPENAI_API_KEY"); // fail fast if missing

const supabase = createClient(url, serviceKey);

async function main() {
  console.log("[env ok] Using Supabase URL:", url);

  const { data: reviews, error: rErr } = await supabase
    .from("reviews")
    .select("id, body, product_id");
  if (rErr) throw rErr;

  const { data: embeds, error: eErr } = await supabase
    .from("review_embeddings")
    .select("review_id");
  if (eErr) throw eErr;

  type ReviewRow = { id: string; body: string; product_id: string };
  type EmbeddingRow = { review_id: string };

  const existing = new Set((embeds ?? []).map((x: EmbeddingRow) => x.review_id));
  const missing: ReviewForEmbedding[] = (reviews ?? [])
    .filter((r: ReviewRow) => !existing.has(r.id))
    .map((r: ReviewRow) => ({ id: r.id, content: r.body }));

  console.log(
    `[backfill] total reviews=${reviews?.length ?? 0}, have embeddings=${
      embeds?.length ?? 0
    }, missing=${missing.length}`
  );

  if (missing.length === 0) {
    console.log("[backfill] Nothing to do. Exiting.");
    return;
  }

  await upsertReviewEmbeddings(missing, 50);
  console.log("[backfill] Done.");

  const { data: after } = await supabase
    .from("review_embeddings")
    .select("review_id");
  console.log("[embeddings] total after:", after?.length ?? 0);
}

main().catch((e) => {
  console.error("[ERROR]", e);
  process.exit(1);
});