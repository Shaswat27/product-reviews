import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";


/** Use ONLY in Server Components / Layouts. Never writes cookies. */
export async function supabaseServerRead() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Allow refresh token rotations to persist during reads.
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}