export const dynamic_trends = 'force-dynamic';
export const revalidate_trends = 0;
export const fetchCache_trends = 'force-no-store';


import { NextRequest as NReq, NextResponse as NRes } from 'next/server';
import { supabaseService as ssvc } from '@/lib/insights/_supabase';
import { getTrends as gtr } from '@/lib/insights/queries';


export async function GET(req: NReq) {
const { searchParams } = new URL(req.url);
const manifestId = searchParams.get('manifest_id');
if (!manifestId) return NRes.json({ error: 'manifest_id is required' }, { status: 400 });
const sb = ssvc();
const rows = await gtr(sb, manifestId);
// Deterministic order by topic_key already ensured
return NRes.json(rows);
}