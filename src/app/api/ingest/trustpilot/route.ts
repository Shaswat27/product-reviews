// app/api/ingest/trustpilot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
const isDev =
  process.env.NODE_ENV !== 'production' ||
  process.env.VERCEL_ENV === 'preview';

function fail(status: number, msg: string, extra?: unknown) {
  return NextResponse.json(
    { error: msg, ...(isDev && extra ? { hint: extra } : {}) },
    { status }
  );
}

// Guard envs early (common 500 cause)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// ---------- Schemas & Types (no `any`) ----------
const ReviewMetaSchema = z.object({
  url: z.string().url().optional(),
}).catchall(z.unknown());
type ReviewMeta = z.infer<typeof ReviewMetaSchema>;

const MockRowSchema = z.object({
  id: z.string().optional(),
  product_id: z.string(),
  source: z.string(), // we'll filter to 'trustpilot'
  rating: z.number().int().min(1).max(5).optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  body: z.string(),
  meta: ReviewMetaSchema.optional(),
});
// type MockRow = z.infer<typeof MockRowSchema>;

const BodySchema = z.object({ productId: z.string().min(1) });

type ReviewInsert = {
  product_id: string;
  source: 'trustpilot';
  rating: number | null;
  review_date: string | null;
  body: string;
  meta: ReviewMeta | null;
};

// ---------- Supabase admin client (server-only) ----------
const supabaseAdmin = createClient(
  SUPABASE_URL,
  SERVICE_KEY,
  { auth: { persistSession: false } }
);

// ---------- Utils ----------
function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export async function POST(req: NextRequest) {
  try {
    // 0) Read raw once
    let raw = await req.text();

    // TEMP: log what we got (remove when done)
    if (isDev) console.log('INGEST RAW BODY:', JSON.stringify(raw));

    // Sometimes PowerShell + curl.exe send single quotes literally
    if (raw.startsWith("'") && raw.endsWith("'")) {
    raw = raw.slice(1, -1);
    }

    let bodyUnknown: unknown = undefined;

    // Prefer JSON
    try {
    if (raw) bodyUnknown = JSON.parse(raw);
    } catch {
    // If not JSON, try URL-encoded (e.g., "productId=notion")
    const params = new URLSearchParams(raw);
    const pid = params.get('productId');
    if (pid) bodyUnknown = { productId: pid };
    }

    const parsed = BodySchema.safeParse(bodyUnknown);
    if (!parsed.success) {
    return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.flatten() },
        { status: 400 }
    );
    }
    const { productId } = parsed.data;

    // 1) Read mock file (fail clearly if missing)
    const filePath = path.join(process.cwd(), 'src','data', 'mock_reviews.json');
    try { await fs.stat(filePath); } 
    catch { return fail(500, 'mock_reviews.json not found', { expectedPath: filePath }); }
    const fileText = await fs.readFile(filePath, 'utf-8');
    const allParse = z.array(MockRowSchema).safeParse(JSON.parse(fileText));
    if (!allParse.success) {
      return fail(500, 'Invalid mock_reviews.json shape', allParse.error.flatten());
    }
    const all = allParse.data

    // 2) Filter to this product + trustpilot
    const candidate = all.filter(
      (r) => r.product_id === productId && r.source === 'trustpilot'
    );

    if (candidate.length === 0) {
      return NextResponse.json({ inserted: 0, skipped: 0, message: 'No mock rows for this productId.' });
    }

    // 3) Fetch existing metas (typed as unknown) and extract safe URLs
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('reviews')
      .select('meta')
      .eq('product_id', productId)
      .eq('source', 'trustpilot');

    if (existErr) {
      return NextResponse.json({ error: existErr.message }, { status: 500 });
    }

    type ExistingMetaRow = { meta: unknown };
    const existingRows: ExistingMetaRow[] = (existing ?? []) as ExistingMetaRow[];

    const existingUrls = new Set<string>();
    for (const row of existingRows) {
      const m = ReviewMetaSchema.safeParse(row.meta);
      if (m.success && isNonEmptyString(m.data.url)) {
        existingUrls.add(m.data.url);
      }
    }

    // 4) Build inserts (skip any with existing meta.url)
    const toInsert: ReviewInsert[] = candidate
      .filter((r) => {
        const url = r.meta?.url;
        return url ? !existingUrls.has(url) : true;
      })
      .map((r) => ({
        product_id: r.product_id,
        source: 'trustpilot',
        rating: r.rating ?? null,
        review_date: r.review_date ?? null,
        body: r.body,
        meta: r.meta ?? null,
      }));

    if (toInsert.length === 0) {
      return NextResponse.json({ inserted: 0, skipped: candidate.length, message: 'All rows already present.' });
    }

    // 5) Insert
    const { error: insertErr, count } = await supabaseAdmin
      .from('reviews')
      .insert(toInsert, { count: 'exact' });

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const skipped = candidate.length - (count ?? 0);
    return NextResponse.json({ inserted: count ?? 0, skipped });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Server error';
    if (isDev) console.error('INGEST ERROR:', e);
    return fail(500, message);
  }
}