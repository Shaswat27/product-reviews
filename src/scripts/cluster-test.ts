import "dotenv/config";
import { clusterReviewsByProduct } from "../lib/cluster";

async function main() {
  const productId = process.argv[2] ?? "notion"; // pass a product id or default
  const eps = Number(process.argv[3] ?? 0.18);
  const minPts = Number(process.argv[4] ?? 6);

  const clusters = await clusterReviewsByProduct(productId, { eps, minPts });
  console.log(JSON.stringify({ productId, eps, minPts, clusters }, null, 2));
}

main().catch((e) => {
  console.error("Cluster smoke failed:", e);
  process.exit(1);
});
