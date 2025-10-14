// src/app/api/synthesize/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { synthesizeTheme } from "@/lib/synthesize";

const EvidenceRef = z.object({
  type: z.enum(["review","support_ticket","call","other"]).default("review"),
  id: z.string(),
});
const Example = z.object({ snippet: z.string().min(5), evidence: EvidenceRef });
const Body = z.object({
  theme_id: z.string().uuid(),
  examples: z.array(Example).optional(),
});

export async function POST(req: NextRequest) {
  const { theme_id, examples } = Body.parse(await req.json());

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // fetch theme
  const { data: theme, error } = await supabase
    .from("themes")
    .select("id, product_id, name, summary")
    .eq("id", theme_id)
    .single();
  if (error || !theme) {
    return NextResponse.json({ ok: false, error: "Theme not found" }, { status: 404 });
  }

  // derive examples if not provided
  let ex = examples;
  if (!ex || ex.length === 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("id, body, review_date")
      .eq("product_id", theme.product_id)
      .order("review_date", { ascending: false })
      .limit(6);

    ex = (reviews ?? []).map(r => ({
      snippet: String(r.body ?? "").slice(0, 240),
      evidence: { type: "review" as const, id: String(r.id) },
    })).slice(0, Math.max(2, Math.min(6, (reviews ?? []).length)));

    if (!ex.length) {
      return NextResponse.json(
        { ok: false, error: "No examples available; pass examples in the request." },
        { status: 400 }
      );
    }
  }

  // call your lib (it inserts into actions)
  const result = await synthesizeTheme({
    theme_id: theme.id,
    theme: theme.name,
    summary: theme.summary ?? "",
    examples: ex,
    productId: theme.product_id,
  });

  return NextResponse.json({ ok: true, result }, { status: 200 });
}