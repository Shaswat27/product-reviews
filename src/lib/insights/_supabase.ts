import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function supabaseService(): SupabaseClient {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // server-only
if (!url || !key) throw new Error('Missing SUPABASE envs');
return createClient(url, key, { auth: { persistSession: false } });
}