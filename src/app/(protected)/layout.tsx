// app/(protected)/layout.tsx
import { redirect } from "next/navigation"
import { supabaseServerRead } from "@/lib/supabaseServerRead"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServerRead()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")
  return <>{children}</>
}