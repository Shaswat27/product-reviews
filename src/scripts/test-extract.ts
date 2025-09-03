// scripts/test-extract.ts
import fs from "node:fs";
import path from "node:path";
// Use CJS-style dotenv load (no top-level await)
import dotenv from "dotenv";
dotenv.config();

type Review = {
  id?: string;
  product_id: string;
  source: string;
  rating?: number;
  review_date?: string;
  body: string;
  meta?: unknown;
};

(async () => {
  // __dirname is available under CJS compilation
  const dataPathLocal = path.resolve(__dirname, "../data/mock_reviews.json");
  const dataPathFallback = "C:/mnt/data/mock_reviews.json"; // adjust if needed
  const dataPath = fs.existsSync(dataPathLocal) ? dataPathLocal : dataPathFallback;

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Missing ANTHROPIC_API_KEY. Add it to .env.local");
    process.exit(1);
  }

  // Dynamic import INSIDE the async function (ok under CJS)
  const { extractFromReview } = await import("../lib/extract");

  const raw = fs.readFileSync(dataPath, "utf-8");
  const reviews: Review[] = JSON.parse(raw);
  const sample = reviews.slice(0, 3);

  console.log(`Loaded ${reviews.length} reviews from ${dataPath}`);
  console.log("Running extraction on:", sample.map(r => r.id ?? "(no id)"));

  for (const r of sample) {
    const res = await extractFromReview({ body: r.body, meta: r.meta });
    console.log("\n────────────────────────────────");
    console.log(`Review ${r.id ?? "N/A"}`);
    console.log(`Text: ${r.body}`);
    console.log("Extracted:", JSON.stringify(res, null, 2));
  }

  console.log("\n✅ Done.");
})().catch(err => {
  console.error(err);
  process.exit(1);
});