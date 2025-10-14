// lib/cluster.ts
import { createClient } from "@supabase/supabase-js";
import type { PostgrestError } from "@supabase/supabase-js";
// NEW: Import the HDBSCAN library
import { HDBSCAN } from 'hdbscan-ts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // read-only is fine for fetch
);

type EmbRow = {
  review_id: string;
  embedding: number[];
};

type ReviewEmbeddingRow = {
  id: string;
  product_id: string;
  review_embeddings: { embedding: number[] }[] | null;
};

// lib/cluster.ts (fetch)
export async function fetchEmbeddingsByProduct(
  productId: string
): Promise<EmbRow[]> {
  const { data, error }: { data: ReviewEmbeddingRow[] | null; error: PostgrestError | null } =
    await supabase
      .from("reviews")
      .select("id, product_id, review_embeddings(embedding)")
      .eq("product_id", productId)
      .returns<ReviewEmbeddingRow[]>();

  if (error) throw error;

  // Flatten rows that actually have an embedding
  return (data ?? [])
    .filter((r) => r.review_embeddings?.[0]?.embedding)
    .map((r) => ({
      review_id: r.id,
      embedding: r.review_embeddings![0].embedding,
    }));
}

/**
 * Run HDBSCAN over L2-normalized embeddings.
 * For normalized vectors, Euclidean distance is monotonic with cosine distance,
 * so this approximates cosine clustering.
 */
export async function clusterReviewsByProduct(
  productId: string,
  opts: { minClusterSize?: number, minSamples?: number } = {}
): Promise<Record<number, string[]>> {
  // UPDATED: Use minClusterSize, which is the primary parameter for HDBSCAN
  const minClusterSize = opts.minClusterSize ?? 5; // Default to 5
  const minSamples = opts.minSamples ?? 10; // Default to 10

  const rows = await fetchEmbeddingsByProduct(productId);
  if (rows.length === 0) return {};

  const vectors = rows.map((r) => r.embedding);

  // UPDATED: Call HDBSCAN instead of DBSCAN
  // UPDATED: Instantiate the class and call the .run() method
  const clusterer = new HDBSCAN({minClusterSize, minSamples})
  const labels: number[] = clusterer.fit(vectors);

  // Map cluster index -> review_ids
  const result: Record<number, string[]> = {};
  labels.forEach((clusterId, index) => {
    // Noise points are labeled -1, ignore them
    if (clusterId === -1) return;

    if (!result[clusterId]) {
      result[clusterId] = [];
    }
    result[clusterId].push(rows[index].review_id);
  });

  return result;
}