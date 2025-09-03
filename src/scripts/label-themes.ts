#!/usr/bin/env tsx
/**
 * Day 12 — Label clusters and write to Supabase `themes`
 * Aligns with:
 *  - extractFromReview(review, opts?) → Promise<Extracted>
 *  - clusterReviewsByProduct(productId, { eps?, minPts? }) → Promise<Record<number, string[]>>
 *
 * DB insert matches schema: product_id, name, severity, trend, evidence_count, summary
 * (trend stays 0 for now; Day 14 computes real WoW). :contentReference[oaicite:3]{index=3}:contentReference[oaicite:4]{index=4}
 */

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// your implementations:
import { extractFromReview } from "@/lib/extract";
import { clusterReviewsByProduct } from "@/lib/cluster";

import { labelClusterTheme } from "@/lib/themes";

type ThemeInsert = {
  product_id: string;
  name: string;
  severity: "low"|"medium"|"high";
  trend?: number | null;
  evidence_count: number;
  summary: string;
};

async function main() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anthropicKey = process.env.ANTHROPIC_API_KEY!;
  if (!url || !key || !anthropicKey) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY");

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  const promptTemplate = fs.readFileSync(path.resolve("src/prompts/theme-labeling.md"), "utf8");

  // authoritative product list from reviews
  const { data: revProds, error: rpErr } = await supabase.from("reviews").select("product_id");
  if (rpErr) throw rpErr;
  const productIds = Array.from(new Set((revProds ?? []).map(r => r.product_id).filter(Boolean))) as string[];
  if (!productIds.length) {
    console.log("No products in reviews. Seed reviews first.");
    return;
  }

  for (const productId of productIds) {
    console.log(`\n=== ${productId} ===`);

    // 1) cluster -> Record<number, string[]>: FOR TESTING ONLY eps/minPts tuned for sample data
    const clustersMap = await clusterReviewsByProduct(productId, { eps: 0.60, minPts: 2 });

    // Fallback: if DBSCAN returns nothing (tiny datasets), treat all reviews as one cluster.
    if (!clustersMap || Object.keys(clustersMap).length === 0) {
        const { data: all, error: allErr } = await supabase
            .from("reviews")
            .select("id")
            .eq("product_id", productId);
        if (allErr) throw allErr;
        if ((all ?? []).length >= 1) {
            clustersMap["0"] = (all ?? []).map(r => r.id);
            console.log(`Fallback: grouping ${clustersMap["0"].length} reviews into cluster #0`);
        }
    }

    const allReviewIds = new Set<string>(Object.values(clustersMap).flat());
    if (!allReviewIds.size) { console.log("No clusters found."); continue; }

    // 2) pull review rows
    const { data: reviewRows, error: rrErr } = await supabase
      .from("reviews")
      .select("id, body, meta")
      .in("id", [...allReviewIds]);
    if (rrErr) throw rrErr;

    // 3) stage-1 extraction using your function
    const extractedByReviewId = new Map<string, Awaited<ReturnType<typeof extractFromReview>>>();
    for (const r of reviewRows ?? []) {
      extractedByReviewId.set(r.id, await extractFromReview({ body: r.body, meta: r.meta }));
    }

    // 4) label each cluster
    const rows: ThemeInsert[] = [];
    for (const [clusterId, reviewIds] of Object.entries(clustersMap)) {
      const labeled = await labelClusterTheme({
        anthropic,
        promptTemplate,
        productId,
        clusterId,
        reviewIds,
        extractedByReviewId,
      });

      rows.push({
        product_id: productId,
        name: labeled.name,
        severity: labeled.severity,
        trend: 0, // filled on Day 14
        evidence_count: labeled.evidence_count,
        summary: labeled.summary,
      });

      console.log(`- cluster #${clusterId}: ${labeled.name} (${labeled.evidence_count})`);
    }

    if (rows.length) {
      const { error: insErr } = await supabase.from("themes").insert(rows);
      if (insErr) throw insErr;
      console.log(`Inserted ${rows.length} theme(s) for ${productId}.`);
    }
  }

  console.log("\n✅ Done.");
}

main().catch((e) => { console.error(e); process.exit(1); });