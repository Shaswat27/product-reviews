/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { fetchNormalizedTrustpilot } from "@/lib/trustpilot/normalize";
import { cacheKey, withCaches, checkAndCountSpend } from "@/lib/cache";

export const runtime = "nodejs";

// GET /api/trustpilot/review?target=<domain-or-url>&limit=100
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target = (searchParams.get("target") ?? "").trim();
    const limit = Math.min(200, Number(searchParams.get("limit") ?? 100));

    if (!target) {
      return NextResponse.json({ error: "Missing target" }, { status: 400 });
    }

    // build cache key without quarter
    const key = cacheKey("tp:reviews:v1", { target, limit });

    // executor that does spend counting + fetch
    const exec = async () => {
      await checkAndCountSpend(1);
      // Call the updated function without the quarter argument
      return fetchNormalizedTrustpilot(target, limit);
    };

    // wrap in cache
    const { items } = await withCaches(key, exec, { hotTtlMin: 15 });

    // Return a response without the quarter field
    return NextResponse.json({
      count: items.length,
      reviews: items,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message ?? "Internal error" }, { status: 500 });
  }
}