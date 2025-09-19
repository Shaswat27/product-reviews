import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { cacheKey, withCaches, checkAndCountSpend } from "@/lib/cache";
import { normalizeQuarter, quarterRange, isoDate } from "@/lib/quarters";
import { trustpilotReviewsREST } from "@/lib/outscraper";

export const runtime = "nodejs";

type RawReview = {
  id?: string;
  url?: string;           // review link
  link?: string;          // alt link key
  text?: string;          // body
  content?: string;       // alt body key
  rating?: number;

  // --- Trustpilot-specific keys seen in your payload ---
  review_id?: string;
  review_text?: string;
  review_title?: string;
  review_rating?: number;
  review_timestamp?: number | string;        // UNIX seconds
  review_datetime_utc?: string;              // "09/18/2025 17:12:02"

  // misc author info
  author?: string;
  user?: { name?: string };

  // keep the generic fallbacks too (if other brands differ)
  date?: string | number | Date;
  time?: string | number | Date;
  timestamp?: string | number;
  published?: string | number;
  published_at?: string | number;
  publishedAt?: string | number;
  publish_date?: string | number;
  datePublished?: string | number;
  created?: string | number;
  created_at?: string | number;
  createdAt?: string | number;
  created_time?: string | number;
  date_of_experience?: string | number;
  dateOfExperience?: string | number;
};

function pickReviewUrl(r: RawReview): string | null {
  // Prefer explicit url/link if present; otherwise build from review_id
  if (r.url) return r.url;
  if (r.link) return r.link;
  if (r.review_id) return `https://www.trustpilot.com/reviews/${r.review_id}`;
  return null;
}

function pickBody(r: RawReview): string {
  const title = (r.review_title ?? "").toString().trim();
  const text  = (r.review_text  ?? r.text ?? r.content ?? "").toString().trim();
  if (title && text) return `${title} — ${text}`;
  return title || text;
}

function pickRating(r: RawReview): number | null {
  if (typeof r.review_rating === "number") return r.review_rating;
  if (typeof r.rating === "number") return r.rating;
  return null;
}

// parse "MM/DD/YYYY HH:mm:ss" safely (UTC)
function parseUsUtcDateTime(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [ , mm, dd, yyyy, HH, MM, SS ] = m.map(Number) as unknown as number[];
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM, SS));
  return isNaN(d.getTime()) ? null : d;
}

function parseDateFlexible(val: any): Date | null {
  if (val == null) return null;

  // Numeric unix (seconds or ms)
  if (typeof val === "number") {
    const n = val > 1e12 ? val : val * 1000; // seconds -> ms
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === "string" && /^\d+$/.test(val)) {
    const num = Number(val);
    const n = num > 1e12 ? num : num * 1000;
    const d = new Date(n);
    return isNaN(d.getTime()) ? null : d;
  }
  // Try US UTC format explicitly
  if (typeof val === "string") {
    const dt = parseUsUtcDateTime(val);
    if (dt) return dt;
  }
  // Fallback: native Date parse
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function toISODateAny(r: RawReview): string | null {
  // Put your payload’s keys FIRST
  const candidates = [
    r.review_timestamp,
    r.review_datetime_utc,
    // fallbacks (cover other brands)
    r.date, r.time, r.timestamp,
    r.published, r.published_at, r.publishedAt, r.publish_date, r.datePublished,
    r.created, r.created_at, r.createdAt, r.created_time,
    r.date_of_experience, r.dateOfExperience,
  ];
  for (const v of candidates) {
    const d = parseDateFlexible(v);
    if (d) return d.toISOString().slice(0, 10);
  }
  return null;
}

type NormalizedReview = {
  product_id: string;
  rating?: number | null;
  review_date: string;
  body: string;
  normalized_body: string;
  body_sha: string;
  source_url: string | null;
  meta: Record<string, any>;
  source_id: string | null;
};

function toISODate(anyDate: RawReview["date"]): string | null {
  if (!anyDate) return null;
  const d = new Date(anyDate as any);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function normalizeBody(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();
}
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function extractDomainFromTarget(target: string): string {
  try {
    const u = new URL(target.includes("://") ? target : `https://${target}`);
    return u.hostname.toLowerCase();
  } catch {
    return target.toLowerCase();
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target = (searchParams.get("target") ?? "").trim();
    const quarter = (searchParams.get("quarter") ?? "").trim();
    const limit = Math.min(200, Number(searchParams.get("limit") ?? 2));
    const debug = searchParams.get("debug") === "1";

    if (!target) return NextResponse.json({ error: "Missing target" }, { status: 400 });
    if (!quarter) return NextResponse.json({ error: "Missing quarter" }, { status: 400 });

    const qNorm = normalizeQuarter(quarter);
    const key = cacheKey("tp:reviews:v1", { target, quarter: qNorm, limit, __d: debug ? 1 : 0 });

    const exec = async () => {
      await checkAndCountSpend(1);
      const { reviews: raw, rawBlock } = await trustpilotReviewsREST(target, limit, { languages: "default", sort: "recency" });
      const product_id = extractDomainFromTarget(target);
      const { start, end } = quarterRange(qNorm);

      // pre-filter snapshot
      const pre = Array.isArray(raw) ? raw.slice(0, 2) : [];
      const preKeys = pre[0] && typeof pre[0] === "object" ? Object.keys(pre[0]).slice(0, 30) : [];

      const normalized = (raw as RawReview[])
        .filter((r) => {
          const iso = toISODateAny(r);
          if (!iso) return false;
          const d = new Date(iso + "T00:00:00Z");
          return d >= start && d <= end;
        })
        .map((r) => {
          const body = pickBody(r);
          const normalized_body = normalizeBody(body);
          const body_sha = sha256(normalized_body);
          const review_date = toISODateAny(r) ?? isoDate(start);
          return {
            product_id,
            rating: typeof r.rating === "number" ? r.rating : null,
            review_date,
            body,
            normalized_body,
            body_sha,
            source_url: pickReviewUrl(r),
            meta: {
              author: r.author ?? r.user?.name ?? null,
              outscraper_id: r.id ?? null,
            },
            source_id: (r.id ?? null) as string | null,
          } as NormalizedReview;
        });

      return {
        items: normalized,
        quarter: qNorm,
        count: normalized.length,
        ...(debug ? {
          _debug: {
            rawBlockKeys: rawBlock && typeof rawBlock === "object" ? Object.keys(rawBlock).slice(0, 30) : [],
            firstItemKeys: preKeys,
            firstItemPreview: pre[0] ?? null,  // tiny preview, one item
            preCount: Array.isArray(raw) ? raw.length : 0
          }
        } : {})
      };
    };

    const data = debug ? await exec() : await withCaches(key, exec, { hotTtlMin: 15 });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Internal error" }, { status: 500 });
  }
}