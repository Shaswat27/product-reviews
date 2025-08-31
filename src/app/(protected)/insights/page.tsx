export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store';

import ProductPicker from "@/components/ProductPicker";
import { supabaseServerRead } from "@/lib/supabaseServerRead";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ExportAllButton from "@/components/ExportAllButton";
import { Calendar, Download, Eye } from "lucide-react";

type InsightReport = {
  id: string;
  product_id: string;
  title: string;
  summary: string;
  date: string;
};

type Product = { id: string; name: string; slug?: string };

export default async function Insights({ searchParams }: { searchParams?: { product?: string | string[] } }) {
  const sp = await searchParams;
  const q = Array.isArray(sp?.product) ? sp?.product[0] : sp?.product;

  const supabase = await supabaseServerRead();

  // 1) Load products from Supabase (authoritative)
  const { data: pr, error: prErr } = await supabase
      .from("insight_reports")
      .select("product_id")
      .order("product_id", { ascending: true });
  if (prErr) throw prErr;
  const productIds = Array.from(new Set((pr ?? []).map(r => r.product_id))).filter(Boolean) as string[];
  const productList: Product[] = productIds.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
  
  // 2) Pick selection: use ?product if present & valid; otherwise first product
  const selectedId = (q && productIds.includes(q)) ? q : productIds[0];

  // 3) Load reports for selected product (allow empty results!)
  const { data: reports, error: reportsErr } = await supabase
    .from("insight_reports")
    .select("id, product_id, title, summary, date:week_start::date")
    .eq("product_id", selectedId ?? "__none__")
    .order("week_start", { ascending: false });
  if (reportsErr) throw reportsErr;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-[hsl(var(--primary))]">Insight Reports</h1>
          <p className="body-ink -mt-1">Historical analysis for the selected product</p>
        </div>
        <ProductPicker products={productList} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          <ExportAllButton productId={selectedId} />
        </div>

        {(!reports || reports.length === 0) ? (
          <div className="text-sm text-muted-foreground border rounded-md p-6">
            No reports yet for this product.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (<ReportCard key={report.id} report={report} />))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: InsightReport }) {
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  return (
    <Card className="card-3d transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <CardDescription className="mt-1">{report.summary}</CardDescription>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(report.date)}</span>
            </div>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="outline" size="sm">
              <Eye className="mr-1 h-4 w-4" />
              View
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}