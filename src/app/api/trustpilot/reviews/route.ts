/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { normalizeQuarter } from "@/lib/quarters";
import { fetchNormalizedTrustpilot } from "@/lib/trustpilot/normalize";
import { cacheKey, withCaches, checkAndCountSpend } from "@/lib/cache";

export const runtime = "nodejs";

// GET /api/trustpilot/review?target=<domain-or-url>&quarter=2025Q3&limit=100
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target = (searchParams.get("target") ?? "").trim();
    const quarterRaw = (searchParams.get("quarter") ?? "").trim();
    const quarter = quarterRaw.replace("-", ""); // accepts 2025-Q3 or 2025Q3
    const limit = Math.min(200, Number(searchParams.get("limit") ?? 2));

    if (!target) {
      return NextResponse.json({ error: "Missing target" }, { status: 400 });
    }
    if (!quarter) {
      return NextResponse.json({ error: "Missing quarter" }, { status: 400 });
    }

    const qNorm = normalizeQuarter(quarter);

    // build cache key
    const key = cacheKey("tp:reviews:v1", { target, quarter: qNorm, limit });

    // executor that does spend counting + fetch
    const exec = async () => {
      await checkAndCountSpend(1);
      return fetchNormalizedTrustpilot(target, qNorm, limit);
    };

    // wrap in cache
    const { items, count } = await withCaches(key, exec, { hotTtlMin: 15 });

    return NextResponse.json({
      quarter: qNorm,
      count: items.length,
      reviews: items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message ?? "Internal error" }, { status: 500 });
  }
}