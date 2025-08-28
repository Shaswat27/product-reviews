import ProductPicker from "@/components/ProductPicker";
import reportsJson from "@/data/mock_insights.json";
import productsJson from "@/data/mock_products.json";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Calendar, CheckCircle, Clock, Download, Eye } from "lucide-react";

type InsightReport = {
  id: string;
  product_id: string;
  status: "completed" | "draft";
  themes_count: number;
  title: string;
  summary: string;
  date: string;
};

export default async function Insights({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.product) ? sp.product[0] : sp.product;

  const products = productsJson as { id: string; name: string }[];
  const selectedId =
    q && products.some((p) => p.id === q) ? q : products[0].id;

  const reports = (reportsJson as InsightReport[]).filter(r => r.product_id === selectedId);
  const total = reports.length;
  const completed = reports.filter(r => r.status === "completed").length;
  const drafts = reports.filter(r => r.status === "draft").length;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-[hsl(var(--primary))]">Insight Reports</h1>
          <p className="body-ink -mt-1">Historical analysis for the selected product</p>
        </div>
        <ProductPicker />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-3d stat-card"><CardContent className="p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{total}</p><p className="text-sm text-muted-foreground">Total Reports</p></div>
          </div>
        </CardContent></Card>
        <Card className="card-3d stat-card"><CardContent className="p-6">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{completed}</p><p className="text-sm text-muted-foreground">Completed</p></div>
          </div>
        </CardContent></Card>
        <Card className="card-3d stat-card"><CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <div><p className="text-2xl font-bold">{drafts}</p><p className="text-sm text-muted-foreground">Drafts</p></div>
          </div>
        </CardContent></Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Reports</h2>
          <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-2" />Export All</Button>
        </div>

        <div className="space-y-3">
          {reports.map((report) => <ReportCard key={report.id} report={report} />)}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ report }: { report: InsightReport }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  return (
    <Card className="card-3d transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={report.status === "completed" ? "default" : "secondary"}>
                {report.status === "completed" ? "Completed" : "Draft"}
              </Badge>
              <Badge variant="outline">{report.themes_count} themes</Badge>
            </div>
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <CardDescription className="mt-1">{report.summary}</CardDescription>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formatDate(report.date)}</span>
            </div>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="outline" size="sm"><Eye className="mr-1 h-4 w-4" />View</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}