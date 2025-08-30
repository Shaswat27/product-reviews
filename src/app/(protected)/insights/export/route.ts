import { NextResponse } from "next/server";
import reportsJson from "@/data/mock_insights.json";

type InsightReport = {
  id: string;
  product_id: string;
  title: string;
  summary: string;
  date: string;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const product = searchParams.get("product") ?? undefined;

  // Today: read from mock JSON
  const reports = (reportsJson as InsightReport[]).filter(
    (r) => !product || r.product_id === product
  );

  // Tomorrow: replace with DB query (e.g., Supabase) using req params (product, date range, page, etc.)

  const iso = new Date().toISOString().slice(0, 10);
  const filename = `insights-${product ?? "all"}-${iso}.json`;

  return new NextResponse(JSON.stringify(reports, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}