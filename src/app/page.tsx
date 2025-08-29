// app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServerRead } from "@/lib/supabaseServerRead";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const supabase = await supabaseServerRead();                // ← await
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? "/dashboard" : "/login");
}