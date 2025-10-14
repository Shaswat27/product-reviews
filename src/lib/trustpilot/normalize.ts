// src/lib/trustpilot/normalize.ts
/* eslint-disable no-console */
import crypto from "node:crypto";
import { trustpilotReviewsREST } from "@/lib/outscraper";

export type RawReview = {
  id?: string; url?: string; link?: string;
  text?: string; content?: string; rating?: number;
  review_id?: string; review_text?: string; review_title?: string;
  review_rating?: number; review_timestamp?: number | string;
  review_datetime_utc?: string;
  author?: string; user?: { name?: string };
  date?: string | number | Date; time?: string | number | Date; timestamp?: string | number;
  published?: string | number; published_at?: string | number; publishedAt?: string | number;
  publish_date?: string | number; datePublished?: string | number;
  created?: string | number; created_at?: string | number; createdAt?: string | number;
  created_time?: string | number; date_of_experience?: string | number; dateOfExperience?: string | number;
};

export type NormalizedReview = {
  product_id: string;
  rating: number | null;
  review_date: string; // "YYYY-MM-DD"
  body: string;
  normalized_body: string;
  body_sha: string;    // hex digest
  source_url: string | null;
  meta: { author: string | null; outscraper_id: string | null };
  source_id: string | null;
};

export function pickReviewUrl(r: RawReview): string | null {
  if (r.url) return r.url;
  if (r.link) return r.link;
  if (r.review_id) return `https://www.trustpilot.com/reviews/${r.review_id}`;
  return null;
}

export function pickBody(r: RawReview): string {
  const title = (r.review_title ?? "").toString().trim();
  const text  = (r.review_text  ?? r.text ?? r.content ?? "").toString().trim();
  if (title && text) return `${title} — ${text}`;
  return title || text;
}

export function parseUsUtcDateTime(s: string): Date | null {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, mmStr, ddStr, yyyyStr, HHStr, MMStr, SSStr] = m;
  const mm = Number(mmStr), dd = Number(ddStr), yyyy = Number(yyyyStr);
  const HH = Number(HHStr), MM = Number(MMStr), SS = Number(SSStr);
  const d = new Date(Date.UTC(yyyy, mm - 1, dd, HH, MM, SS));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateFlexible(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v > 1e9 ? v * 1000 : v;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return parseDateFlexible(Number(s));
    const us = parseUsUtcDateTime(s);
    if (us) return us;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function toISODateAny(r: RawReview): string | null {
  const candidates: Array<unknown> = [
    r.review_timestamp, r.review_datetime_utc,
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

export function normalizeBody(s: string) {
  return s.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim().toLowerCase();
}

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export function extractDomainFromTarget(target: string): string {
  try {
    const u = new URL(target.includes("://") ? target : `https://${target}`);
    return u.hostname.toLowerCase();
  } catch {
    return target.toLowerCase();
  }
}

/**
 * Fetch + normalize the most recent Trustpilot reviews for a target.
 * Returns the same "NormalizedReview[]" shape used by your /trustpilot/review route.
 */
export async function fetchNormalizedTrustpilot(
  target: string,
  limit: number,
): Promise<{ items: NormalizedReview[]; count: number }> {
  const product_id = extractDomainFromTarget(target);

  const { reviews: raw } = await trustpilotReviewsREST(
    target,
    limit,
    { languages: "default", sort: "recency" }
  );

  const input: RawReview[] = Array.isArray(raw)
    ? ((raw as unknown[]).filter((v): v is RawReview => !!v && typeof v === "object"))
    : [];

  const normalized = input
    .filter((r) => {
      // Ensure the review has a parseable date before continuing
      return !!toISODateAny(r);
    })
    .map((r) => {
      const bodyRaw = pickBody(r);
      const body = bodyRaw ?? "";
      const normalized_body = normalizeBody(body);
      const body_sha = sha256(normalized_body);
      const review_date = toISODateAny(r)!; // Non-null assertion is safe due to the filter above

      return {
        product_id,
        rating: typeof r.rating === "number" ? r.rating : null,
        review_date,
        body,
        normalized_body,
        body_sha,
        source_url: pickReviewUrl(r),
        meta: { author: r.author ?? r.user?.name ?? null, outscraper_id: r.id ?? null },
        source_id: r.id ?? null,
      } satisfies NormalizedReview;
    });

  return { items: normalized.slice(0, limit), count: normalized.length };
}