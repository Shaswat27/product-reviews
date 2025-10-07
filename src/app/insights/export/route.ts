// app/insights/export/route.ts
import { NextResponse } from "next/server";
import { supabaseServerRead } from "@/lib/supabaseServerRead";

/*type ExportRow = {
  id: string;
  product_id: string;
  title: string | null;
  summary: string | null;
  // ISO date from week_start, e.g. "2025-08-25"
  date: string;
};*/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product") ?? "";
  const fileBase = searchParams.get("fileBase") ?? "insights";

  if (!product) {
    return NextResponse.json({ error: "Missing ?product" }, { status: 400 });
  }

  const supabase = await supabaseServerRead();
  const { data, error } = await supabase
    .from("insight_reports")
    .select("*")
    .eq("product_id", product)
    .order("week_start", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Force a file download with a product-scoped filename
  return new NextResponse(JSON.stringify(data), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${fileBase}-${product}.json"`,
    },
  });
}