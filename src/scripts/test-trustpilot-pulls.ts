// scripts/smoke_d15.ts
/* eslint-disable no-console */
import { createServer } from "http";

function currentQuarterStr(d = new Date()) {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";
const QUERY = process.env.SMOKE_QUERY ?? "Notion";
const TARGET = process.env.SMOKE_TARGET ?? "notion.so";
const QUARTER = process.env.SMOKE_QUARTER ?? currentQuarterStr();

async function hit(path: string) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} — ${url}\n${txt}`);
  }
  return res.json();
}

(async () => {
  console.log("== Day 15 Smoke ==");
  console.log({ BASE, QUERY, TARGET, QUARTER });

  // 1) Search
  const search = await hit(`/api/trustpilot/search?query=${encodeURIComponent(QUERY)}&limit=5`);
  console.log("\n[search] items:", search.items?.length ?? 0);
  console.log(search.items?.slice(0, 3));

  // 2) Reviews
  const reviews = await hit(`/api/trustpilot/reviews?target=${encodeURIComponent(TARGET)}&quarter=${encodeURIComponent(QUARTER)}&limit=2`);
  console.log("\n[reviews] quarter:", reviews.quarter, "count:", reviews.count);
  console.log(reviews.items?.slice(0, 2)); // show a couple normalized docs

  console.log("\n✅ Smoke completed.");
})().catch((e) => {
  console.error("❌ Smoke failed:", e);
  process.exit(1);
});
