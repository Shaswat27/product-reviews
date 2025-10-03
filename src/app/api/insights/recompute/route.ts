// Route segment config — use Next.js’ canonical names
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest as NRq, NextResponse as NRs } from 'next/server';
import { supabaseService as supa } from '@/lib/insights/_supabase';
import { computeThemeMetricsForManifest } from '@/lib/insights/computeMetrics';
import { computeTrendsQoQ } from '@/lib/insights/computeTrends';

type RecomputeBody = {
  manifest_id?: string;
};

export async function POST(req: NRq): Promise<NRs> {
  // Parse body defensively without `any`
  let body: RecomputeBody = {};
  try {
    const parsed = (await req.json()) as unknown;
    if (parsed && typeof parsed === 'object') {
      body = parsed as RecomputeBody;
    }
  } catch {
    // ignore: keep empty body
  }

  const manifestId = typeof body.manifest_id === 'string' ? body.manifest_id : undefined;
  if (!manifestId) {
    return NRs.json({ error: 'manifest_id is required' }, { status: 400 });
  }

  const sb = supa();

  const metricsCount = await computeThemeMetricsForManifest(sb, manifestId);
  const trendsCount = await computeTrendsQoQ(sb, manifestId);

  return NRs.json({
    ok: true,
    manifest_id: manifestId,
    metrics_upserted: metricsCount,
    trends_upserted: trendsCount,
  });
}