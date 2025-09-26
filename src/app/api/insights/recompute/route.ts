export const dynamic_recompute = 'force-dynamic';
export const revalidate_recompute = 0;
export const fetchCache_recompute = 'force-no-store';


import { NextRequest as NRq, NextResponse as NRs } from 'next/server';
import { supabaseService as supa } from '@/lib/insights/_supabase';
import { computeThemeMetricsForManifest } from '@/lib/insights/computeMetrics';
import { computeTrendsQoQ } from '@/lib/insights/computeTrends';


export async function POST(req: NRq) {
const body = await req.json().catch(() => ({} as any));
const manifestId = body?.manifest_id as string | undefined;
if (!manifestId) return NRs.json({ error: 'manifest_id is required' }, { status: 400 });
const sb = supa();


const metricsCount = await computeThemeMetricsForManifest(sb, manifestId);
const trendsCount = await computeTrendsQoQ(sb, manifestId);


return NRs.json({ ok: true, manifest_id: manifestId, metrics_upserted: metricsCount, trends_upserted: trendsCount });
}