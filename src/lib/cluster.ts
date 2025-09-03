// lib/cluster.ts
import { createClient } from "@supabase/supabase-js";
// @ts-ignore
import * as DC from "density-clustering";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY! // read-only is fine for fetch
);

type EmbRow = {
  review_id: string;
  embedding: number[];
};

// lib/cluster.ts (fetch)
export async function fetchEmbeddingsByProduct(productId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, product_id, review_embeddings(embedding)")
    .eq("product_id", productId);

  if (error) throw error;

  // Flatten rows that actually have an embedding
  return (data ?? [])
    .filter((r: any) => r.review_embeddings?.[0]?.embedding)
    .map((r: any) => ({
      review_id: r.id,
      embedding: r.review_embeddings[0].embedding as number[],
    }));
}

/**
 * Run DBSCAN over L2-normalized embeddings using Euclidean distance.
 * For normalized vectors, Euclidean distance is monotonic with cosine distance,
 * so this approximates cosine clustering without a custom metric.
 */
export async function clusterReviewsByProduct(
  productId: string,
  opts: { eps?: number; minPts?: number } = {}
): Promise<Record<number, string[]>> {
  const eps = opts.eps ?? 0.18;     // try 0.10–0.30
  const minPts = opts.minPts ?? 6;  // try 5–10

  const rows = await fetchEmbeddingsByProduct(productId);
  if (rows.length === 0) return {};

  const vectors = rows.map((r) => r.embedding);

  const dbscan = new (DC as any).DBSCAN();
  // density-clustering uses its own distance; omit to use Euclidean by default.
  const clusters: number[][] = dbscan.run(vectors, eps, minPts);

  // Map cluster index -> review_ids
  const result: Record<number, string[]> = {};
  clusters.forEach((idxs, clusterId) => {
    result[clusterId] = idxs.map((i) => rows[i].review_id);
  });

  return result;
}
