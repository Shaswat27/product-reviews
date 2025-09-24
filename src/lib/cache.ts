// lib/cache.ts (in-memory only for smoke tests)
import crypto from "node:crypto";

type Minutes = number;

const HOT_CACHE_TTL_MIN: Minutes = 10; // 5–30m window
const DEDUPE_WINDOW_MS = 5_000;        // 5s
const DEFAULT_DAILY_BUDGET = Number(process.env.OUTSCRAPER_DAILY_BUDGET ?? 200);

// in-memory stores
const hot = new Map<string, { exp: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();
const dedupe = new Map<string, number>();
const spendCounter = new Map<string, number>(); // key = YYYY-MM-DD

// global cache helpers
export const PROMPT_VERSION = 1 as const; // bump to invalidate cached LLM outputs

function now() { return Date.now(); }
function msFromMinutes(m: Minutes) { return m * 60_000; }

export function cacheKey(namespace: string, payload: unknown) {
  const raw = JSON.stringify(payload);
  const sha = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
  return `${namespace}:${sha}`;
}

export async function withCaches<T>(
  key: string,
  exec: () => Promise<T>,
  { hotTtlMin = HOT_CACHE_TTL_MIN }: { hotTtlMin?: number } = {}
): Promise<T> {
  const t = now();

  // request de-duplication (5s window)
  const last = dedupe.get(key) ?? 0;
  if (t - last < DEDUPE_WINDOW_MS) {
    const entry = hot.get(key);
    if (entry && entry.exp > t) return entry.data as T;
  }
  dedupe.set(key, t);

  // hot cache
  const hit = hot.get(key);
  if (hit && hit.exp > t) return hit.data as T;

  // in-flight dedupe
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;

  const p = (async () => {
    const result = await exec();
    hot.set(key, { exp: t + msFromMinutes(hotTtlMin), data: result });
    return result;
  })().finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export async function checkAndCountSpend(n = 1) {
  const day = new Date().toISOString().slice(0, 10); // UTC day
  const current = spendCounter.get(day) ?? 0;
  const budget = DEFAULT_DAILY_BUDGET;
  if (current + n > budget) {
    throw new Error(`Outscraper daily budget exceeded (${current + n}/${budget}).`);
  }
  spendCounter.set(day, current + n);
}