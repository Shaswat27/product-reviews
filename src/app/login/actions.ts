// src/app/login/actions.ts
'use server'

import { supabaseServerAction } from '@/lib/supabaseServerAction'

export type SetServerSessionResult =
  | { ok: true }
  | { ok: false; error: string }

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'unknown error' }
}

export async function setServerSession(
  access_token: string,
  refresh_token: string
): Promise<SetServerSessionResult> {
  try {
    const supabase = await supabaseServerAction()
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: toErrorMessage(e) }
  }
}