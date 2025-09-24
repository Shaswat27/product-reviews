// src/lib/retry.ts
// ESLint strict-friendly, deterministic (fixed backoff), no jitter.

export type TransportishError = {
  status?: number;        // HTTP status if present
  code?: string;          // Node/SDK error codes (ETIMEDOUT, ECONNRESET, etc.)
  name?: string;          // e.g., AbortError
  message?: string;
};

/** Only retry network/transport faults. Never retry 4xx/validation/content errors. */
export function isTransportError(err: unknown): boolean {
  const e = err as TransportishError;
  if (typeof e?.status === "number") return e.status >= 500;  // 5xx only
  return (
    e?.code === "ETIMEDOUT" ||
    e?.code === "ECONNRESET" ||
    e?.code === "EAI_AGAIN" ||
    e?.name === "AbortError"
  );
}

function toError(x: unknown): Error {
  if (x instanceof Error) return x;
  // Preserve structured info if available
  if (x && typeof x === "object") {
    const maybe = x as Partial<TransportishError>;
    const msg = maybe.message ??
      ((): string => {
        try { return JSON.stringify(x); } catch { return String(x); }
      })();
    const err = new Error(msg);
    if (maybe.name) err.name = maybe.name;
    return err;
  }
  return new Error(String(x));
}

/** Fixed backoff (deterministic). Defaults: 2 attempts, 300ms wait. */
export async function withTransportRetry<T>(
  fn: () => Promise<T>,
  { maxAttempts = 2, backoffMs = 300 }: { maxAttempts?: number; backoffMs?: number } = {},
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (attempt >= maxAttempts || !isTransportError(err)) {
        // Re-throw as an Error to satisfy @typescript-eslint/only-throw-error
        throw toError(err);
      }
      await new Promise((r) => setTimeout(r, backoffMs)); // deterministic wait
    }
  }
  // Should be unreachable, but keep types/lint happy:
  throw toError(last);
}