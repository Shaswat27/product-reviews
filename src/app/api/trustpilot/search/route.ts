// src/app/api/trustpilot/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cacheKey, withCaches, checkAndCountSpend } from "@/lib/cache";
import { trustpilotSearchREST } from "@/lib/outscraper";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim();
    const limit = Number(searchParams.get("limit") ?? 5);
    const debug = searchParams.get("debug") === "1"; // optional: bypass cache for debugging

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const key = cacheKey("tp:search", { query, limit });

    const exec = async () => {
      await checkAndCountSpend(1);
      // trustpilotSearchREST NOW RETURNS: Array<{ name, url, domain, logo }>
      const items = await trustpilotSearchREST(query, limit);
      return items;
    };

    // If your withCaches only takes (key, exec), use the next line:
    const items = debug ? await exec() : await withCaches(key, exec);

    // If your withCaches supports options, you can use:
    // const items = debug ? await exec() : await withCaches(key, exec, { hotTtlMin: 10 });

    return NextResponse.json({ items: Array.isArray(items) ? items : [] });
  } catch (e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message ?? "Internal error" }, { status: 500 });
  }
}