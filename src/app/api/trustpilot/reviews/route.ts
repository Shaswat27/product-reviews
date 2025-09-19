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
  review_timestamp?: number | string;        // UNIX seconds or ms
  review_datetime_utc?: string;              // "MM/DD/YYYY HH:mm:ss"

  // misc author info
  author?: string;
  user?: { name?: string };

  // generic fallbacks (if other sources/brands differ)
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

// ---- Output shape (aligned to your API samples) ----
type NormalizedReview = {
  product_id: string;         // e.g. "notion.so"
  rating: number | null;      // null when absent
  review_date: string;        // ISO "YYYY-MM-DD"
  body: string;               // always string ("" if missing)
  normalized_body: string;    // normalized text
  body_sha: string;           // hex digest
  source_url: string | null;  // direct review link when available
  meta: {
    author: string | null;
    outscraper_id: string | null;
  };
  source_id: string | null;   // mirrors outscraper_id if kept separately
};

// Prefer explicit url/link; else build from review_id (Trustpilot)
function pickReviewUrl(r: RawReview): string | null {
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

// parse "MM/DD/YYYY HH:mm:ss" safely (UTC)
function parseUsUtcDateTime(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, mmStr, ddStr, yyyyStr, HHStr, MMStr, SSStr] = m;
  const mm = Number(mmStr), dd = Number(ddStr), yyyy = Number(yyyyStr);
  const HH = Number(HHStr), MM = Number(MMStr), SS = Number(SSStr);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM, SS));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateFlexible(v: unknown): Date | null {
  if (v == null) return null;

  // Date instance
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;

  // Number (seconds or milliseconds)
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : v; // tolerate seconds
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // String: numeric, US UTC format, or ISO-ish
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;

    // numeric string
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return parseDateFlexible(n);
    }

    // "MM/DD/YYYY HH:mm:ss" UTC
    const us = parseUsUtcDateTime(s);
    if (us) return us;

    // ISO or other Date-parseable formats
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function toISODateAny(r: RawReview): string | null {
  // Put Trustpilot keys first
  const candidates: Array<unknown> = [
    r.review_timestamp,
    r.review_datetime_utc,
    // generic fallbacks
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

      const { reviews: raw, rawBlock } = await trustpilotReviewsREST(
        target,
        limit,
        { languages: "default", sort: "recency" }
      );

      const product_id = extractDomainFromTarget(target);
      const { start, end } = quarterRange(qNorm);

      // pre-filter snapshot for debug
      const pre = Array.isArray(raw) ? (raw as unknown[]).slice(0, 2) : [];
      const first = pre[0];
      const preKeys =
        first && typeof first === "object" && first !== null
          ? Object.keys(first as Record<string, unknown>).slice(0, 30)
          : [];

      // Build normalized list
      const input: RawReview[] = Array.isArray(raw)
        ? ((raw as unknown[]).filter((v) => v && typeof v === "object") as RawReview[])
        : [];

      const normalized: NormalizedReview[] = input
        .filter((r) => {
          const iso = toISODateAny(r);
          if (!iso) return false;
          const d = new Date(`${iso}T00:00:00Z`);
          return d >= start && d <= end;
        })
        .map((r) => {
          const bodyRaw = pickBody(r);
          const body = bodyRaw ?? ""; // ensure string
          const normalized_body = normalizeBody(body);
          const body_sha = sha256(normalized_body);
          const review_date = toISODateAny(r) ?? isoDate(start);

          const item: NormalizedReview = {
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
            source_id: r.id ?? null,
          };
          return item;
        });

      return {
        items: normalized.slice(0, limit),
        quarter: qNorm,
        count: normalized.length,
        ...(debug
          ? {
              _debug: {
                rawBlockKeys:
                  rawBlock && typeof rawBlock === "object"
                    ? Object.keys(rawBlock).slice(0, 30)
                    : [],
                firstItemKeys: preKeys,
                firstItemPreview: first ?? null, // tiny preview, one item
                preCount: Array.isArray(raw) ? (raw as unknown[]).length : 0,
              },
            }
          : {}),
      };
    };

    const data = debug ? await exec() : await withCaches(key, exec, { hotTtlMin: 15 });
    return NextResponse.json(data);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message ?? "Internal error" }, { status: 500 });
  }
}