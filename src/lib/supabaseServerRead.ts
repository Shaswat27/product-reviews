import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Use ONLY in Server Components / Layouts. Never writes cookies. */
export async function supabaseServerRead() {
  const cookieStore = await cookies();
  return createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      // ⛔ SSR must not write cookies in Next 15
      setAll(_cookies: { name: string; value: string; options?: CookieOptions }[]) {
        /* no-op */
      },
    },
  });
}