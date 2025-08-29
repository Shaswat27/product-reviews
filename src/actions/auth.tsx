// src/actions/auth.ts
'use server'

import { redirect } from 'next/navigation'
import { supabaseServerAction } from '@/lib/supabaseServerAction'

export async function logout() {
  const supabase = await supabaseServerAction()  // ← was supabaseServer()
  await supabase.auth.signOut()
  redirect('/login')
}