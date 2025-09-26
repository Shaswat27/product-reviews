export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';


import { NextResponse } from 'next/server';
import { supabaseService } from '@/lib/insights/_supabase';
import { getManifests } from '@/lib/insights/queries';


export async function GET() {
const sb = supabaseService();
const data = await getManifests(sb);
// Stable sort by created_at DESC already in query
return NextResponse.json(data);
}