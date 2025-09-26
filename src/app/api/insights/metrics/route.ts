export const dynamic_metrics = 'force-dynamic';
export const revalidate_metrics = 0;
export const fetchCache_metrics = 'force-no-store';


import { NextRequest, NextResponse as NR } from 'next/server';
import { supabaseService as ss } from '@/lib/insights/_supabase';
import { getMetrics as gm } from '@/lib/insights/queries';


export async function GET(req: NextRequest) {
const { searchParams } = new URL(req.url);
const manifestId = searchParams.get('manifest_id');
if (!manifestId) return NR.json({ error: 'manifest_id is required' }, { status: 400 });
const sb = ss();
const data = await gm(sb, manifestId);
return NR.json(data);
}