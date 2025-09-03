// lib/embeddings.ts
import OpenAI from "openai";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("Missing OPENAI_API_KEY");
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

let _db: SupabaseClient | null = null;
function getDB() {
  if (!_db) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !svc) throw new Error("Missing Supabase URL or SERVICE ROLE key");
    _db = createClient(url, svc);
  }
  return _db;
}

// L2 normalize (safe against zero vector)
export function l2(v: number[]) {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export type ReviewForEmbedding = {
  id: string;
  content: string; // the text to embed
};

export async function embedTextBatch(texts: string[]) {
  if (texts.length === 0) return [];
  try {
    const res = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: texts,
    }); 
    return res.data.map((d) => l2(d.embedding as unknown as number[]));
  } catch (e: any) {
    console.error("[embedTextBatch] OpenAI error:", e?.message || e);
    throw e;
  }
}

/**
 * Generate & upsert embeddings for a list of reviews.
 * Assumes table `review_embeddings(review_id uuid primary key, embedding vector)`
 */
export async function upsertReviewEmbeddings(
  reviews: ReviewForEmbedding[],
  batchSize = 100
) {
  for (let i = 0; i < reviews.length; i += batchSize) {
    const batch = reviews.slice(i, i + batchSize);
    const embeddings = await embedTextBatch(batch.map((r) => r.content));

    const rows = batch.map((r, idx) => ({
      review_id: r.id,
      embedding: embeddings[idx], // already L2-normalized
    }));

    // Supabase upsert (Postgres vector column)
    const { error } = await getDB()
      .from("review_embeddings")
      .upsert(rows, { onConflict: "review_id" });

    if (error) {
      console.error("Upsert error:", error);
      throw error;
    }

    console.log(`[upsert] wrote batch ${i}..${i + batch.length - 1} rows`);
  }
}

/**
 * Convenience: embed & upsert a single review.
 */
export async function upsertSingleReviewEmbedding(review: ReviewForEmbedding) {
  const [vec] = await embedTextBatch([review.content]);
  const { error } = await getDB()
    .from("review_embeddings")
    .upsert(
      [{ review_id: review.id, embedding: vec }],
      { onConflict: "review_id" }
    );
  if (error) throw error;
  return vec;
}