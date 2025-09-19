// src/lib/outscraper.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

const BASE = "https://api.app.outscraper.com";

function assertEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function toURL(path: string, params: Record<string, any>) {
  const url = new URL(path, BASE);
  const { query, ...rest } = params;
  if (Array.isArray(query)) {
    for (const q of query) url.searchParams.append("query", String(q));
  } else if (query != null) {
    url.searchParams.set("query", String(query));
  }
  Object.entries(rest).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return url.toString();
}

async function outscraperGet(path: string, params: Record<string, any>) {
  const apiKey = assertEnv("OUTSCRAPER_API_KEY");
  const url = toURL(path, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-API-KEY": apiKey, Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) throw new Error(`Outscraper GET ${path} failed ${res.status}: ${text}`);
  return json;
}

function firstQueryBlock(resp: any): any {
  if (Array.isArray(resp?.data)) return resp.data[0] ?? {};
  if (Array.isArray(resp)) return resp[0] ?? {};
  return resp?.data ?? resp ?? {};
}

function toArray(maybe: any): any[] {
  if (Array.isArray(maybe)) return maybe;
  if (!maybe || typeof maybe !== "object") return [];
  if (Array.isArray(maybe.items)) return maybe.items;
  if (Array.isArray(maybe.reviews)) return maybe.reviews;
  if (Array.isArray(maybe.data)) return maybe.data;
  const vals = Object.values(maybe);
  return Array.isArray(vals) ? vals : [];
}

// -------- SEARCH (with debug passthrough) --------
// src/lib/outscraper.ts  (replace the mapper in trustpilotSearchREST)
export async function trustpilotSearchREST(query: string, limit = 5) {
  const resp = await outscraperGet("/trustpilot/search", {
    query: [query],
    limit,
    // keep async=false for smoke runs
    async: false,
  });

  const blk = firstQueryBlock(resp);
  const arr = toArray(blk);

  function tpDomainFromPageUrl(u: string | null): string | null {
    if (!u) return null;
    try {
      const url = new URL(u);
      // Expect /review/<domain> — grab the reviewed domain
      const m = url.pathname.match(/\/review\/([^/?#]+)/i);
      if (m) return m[1].toLowerCase();
      return url.hostname.toLowerCase();
    } catch {
      return null;
    }
  }

  return arr.map((r: any) => {
    const pageUrl = r?.page_url ?? null;            // <-- TP page URL
    const site = r?.site ?? null;                   // <-- company site (domain or URL)
    const logo = r?.profile_image ?? null;          // <-- logo/avatar
    const name = r?.name ?? null;

    // Prefer parsing company domain from `site`; if it's a URL, take hostname.
    let domain: string | null = null;
    if (typeof site === "string" && site.length) {
      try {
        domain = site.includes("://")
          ? new URL(site).hostname.toLowerCase()
          : site.toLowerCase();
      } catch {
        domain = site.toLowerCase();
      }
    }
    // Fall back to domain inferred from TP page URL
    if (!domain) domain = tpDomainFromPageUrl(pageUrl);

    return { name, url: pageUrl, domain, logo };
  });
}

// -------- REVIEWS (unchanged for now; we’ll debug it next) --------
export async function trustpilotReviewsREST(target: string, limit = 2, opts?: {
  languages?: "default" | "all" | "en" | "es" | "de";
  sort?: "recency" | "";
}) {
  const resp = await outscraperGet("/trustpilot/reviews", {
    query: [target],
    limit,
    languages: opts?.languages ?? "default",
    sort: opts?.sort ?? "recency",
    async: false,
  });
  const blk = firstQueryBlock(resp);
  const reviews = toArray(blk);
  return { reviews, rawBlock: blk };
}