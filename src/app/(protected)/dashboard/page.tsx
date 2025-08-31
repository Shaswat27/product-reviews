export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store';

import { TrendingUp, TrendingDown, AlertTriangle, Clock, Target, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductPicker from "@/components/ProductPicker";

// Supabase
import { supabaseServerRead } from "@/lib/supabaseServerRead";

// Chart
import ThemeTrends from "@/components/ThemeTrends";

type Severity = "high" | "medium" | "low";
type Product = { id: string; name: string; slug?: string };
type Action = {
  id: string;
  theme_id: string;
  kind: "product" | "gtm";
  description: string;
  impact: number;
  effort: number;
};
type Theme = {
  id: string;
  product_id: string;
  name: string;
  severity: Severity;
  trend: number;
  evidence_count: number;
  summary: string;
};

/* 
type Trend = {
  product_id: string;
  week: string;      // ISO date string
  themes: number;    // count per week
};
*/

type TrendPoint = { week: string; themes: number }; // what ThemeTrends wants
// ---- Supabase row helpers (explicit to satisfy noImplicitAny) ----
type TrendRow =  { week: string; themes: number };
// Theme and Action already defined below; reuse them as row types

const severityConfig = {
  high:     { color: "severity-high",     icon: AlertTriangle, label: "High" },
  medium:   { color: "severity-medium",   icon: Clock,         label: "Medium" },
  low:      { color: "severity-low",      icon: Clock,         label: "Low" },
} as const;

/* function isTrend(x: unknown): x is Trend {
  return (
    typeof x === "object" &&
    x !== null &&
    "product_id" in x &&
    "week" in x &&
    "themes" in x
  );
} */

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  // ✅ Next.js (your version) requires awaiting searchParams in Server Components
  const sp = await searchParams;
  const q = Array.isArray(sp.product) ? sp.product[0] : sp.product;

  // Load products from Supabase (authoritative)
  const supabase = await supabaseServerRead();
  const { data: themeProducts, error: themeProductsErr } = await supabase
    .from("themes")
    .select("product_id")
    .order("product_id", { ascending: true });
  if (themeProductsErr) throw themeProductsErr;
  const productIds = Array.from(new Set((themeProducts ?? []).map(t => t.product_id)))
    .filter(Boolean) as string[];
  const productList: Product[] = productIds.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
  const selectedId = (q && productIds.includes(q)) ? q : productIds[0];

  // Filter by product
  const { data: themes, error: themesErr } = await supabase
    .from("themes")
    .select("id, product_id, name, severity, trend, evidence_count, summary")
    .eq("product_id", selectedId)
    .limit(5);
  if (themesErr) throw themesErr;
  const themesArr = (themes ?? []) as Theme[]; // pin type for downstream callbacks

  // Do the same for actions
  const themeIds = themesArr.map((t: Theme) => t.id);
  const { data: actionsRaw, error: actionsErr } = await supabase
    .from("actions")
    .select("id, theme_id, kind, description, impact, effort")
    .in("theme_id", themeIds.length ? themeIds : ["__none__"]); // guard to avoid full-scan when empty
  if (actionsErr) throw actionsErr;
  const actionsArr = (actionsRaw ?? []) as Action[];
  const actionsByTheme = Object.groupBy(actionsArr, (a: Action) => a.theme_id) as Record<string, Action[]>;

  // const trends: TrendPoint[] = (mockTrendData as unknown[])
  // .filter(isTrend) // optional; remove if you trust the JSON
  // .filter((d) => d.product_id === selectedId)
  // .map(({ week, themes }) => ({ week, themes }));
  // const reviewsCount = (mockReviews as any[]).filter((r) => r.product_id === selectedId).length;
  // Optional: if you created a weekly view/materialized view for trends, use it here.
  // Fallback to empty dataset if the view doesn't exist yet (keeps UI stable).
  let trends: TrendPoint[] = [];
  const { data: trendRows, error: trendsErr } = await supabase
    .from("theme_trends") // <- create as (product_id text, week date, themes int)
    .select("week, themes")
    .eq("product_id", selectedId)
    .order("week", { ascending: true });
  if (!trendsErr && Array.isArray(trendRows)) {
    const trendRowsArr = (trendRows ?? []) as TrendRow[];
    trends = trendRowsArr.map(({ week, themes }: TrendRow) => ({ week, themes })) as TrendPoint[];
  }

  const evidencePoints = themesArr.reduce((sum: number, t: Theme) => sum + (t.evidence_count || 0), 0);
  const actionItems = actionsArr.length;

  // Consolidated Top Actions (compact summary)
  const themeNameById = new Map<string, string>(themesArr.map((t: Theme) => [t.id, t.name]));
  const topActions = actionsArr
    .map(a => ({ ...a, themeName: themeNameById.get(a.theme_id) ?? "Unknown" }))
    .map(a => ({ ...a, score: a.impact - a.effort * 0.5 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* ===== Header with Product Picker ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold heading-accent">
            <span className="text-[hsl(var(--primary))]">SignalLens</span>
            <span className="text-[hsl(var(--foreground))]"> Dashboard</span>
          </h1>
          <p className="body-ink -mt-1">Latest insights for the selected product</p>
        </div>
        <ProductPicker products={productList}/>
      </div>

      {/* ===== Stats Overview ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-severity-high" />
              <div>
                <p className="text-2xl font-bold">
                  {themes.filter((t: Theme) => t.severity === "high").length}
                </p>
                <p className="text-sm text-muted-foreground">High Severity Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-success" />
              <div>
                <p className="text-2xl font-bold">{evidencePoints}</p>
                <p className="text-sm text-muted-foreground">Evidence Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{actionItems}</p>
                <p className="text-sm text-muted-foreground">Action Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Rocket className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">
                  {Math.min(95, 70 + themes.length * 5)}%
                </p>
                <p className="text-sm text-muted-foreground">Confidence Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===== Main Content ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Theme Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Top Customer Themes</h2>
            <Button variant="outline" size="sm" className="border-accent text-accent hover:bg-accent/10">
              View All Themes
            </Button>
          </div>

          <div className="space-y-4">
            {themesArr.map((theme: Theme) => (
              <ThemeCard key={theme.id} theme={theme} actions={actionsByTheme[theme.id] ?? []}/>
            ))}
          </div>
        </div>

        {/* Trends + Top Actions */}
        <div className="space-y-4">
          <Card className="card-3d stat-card">
            <CardHeader>
              <CardTitle className="text-base">Top Actions (This Week)</CardTitle>
              <CardDescription className="body-ink">
                Prioritized across this product’s themes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {topActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions yet.</p>
              ) : (
                topActions.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded bg-secondary">
                    <div className={cn("p-1 rounded", a.kind === "product" ? "bg-primary/10" : "bg-accent/10")}>
                      {a.kind === "product" ? (
                        <Target className="h-3 w-3 text-primary" />
                      ) : (
                        <Rocket className="h-3 w-3 text-accent" />
                      )}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{a.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.kind.toUpperCase()} • {a.themeName} • Impact {a.impact}/10 · Effort {a.effort}/10
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <h2 className="text-xl font-semibold text-foreground">Theme Trends</h2>
          <ThemeTrends data={trends} />
        </div>
      </div>
    </div>
  );
}

/* ===== Theme Card ===== */
interface ThemeCardProps {
  theme: Theme;
  actions: Action[];
}

function ThemeCard({ theme, actions }: ThemeCardProps) {
  const severity = severityConfig[theme.severity];
  const SeverityIcon = severity.icon;
  const isPositiveTrend = theme.trend >= 0;

  return (
    <Card className="card-3d">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Badge
              className={cn(
                "border-0",
                theme.severity === "high" && "badge-high",
                theme.severity === "medium" && "badge-medium",
                theme.severity === "low" && "badge-low"
              )}
            >
              <SeverityIcon className="h-3 w-3 mr-1" />
              {severity.label}
            </Badge>
            <Badge variant="outline">{theme.evidence_count} evidence points</Badge>
          </div>

          <div className="flex items-center space-x-1 text-sm">
            {isPositiveTrend ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : (
              <TrendingDown className="h-4 w-4 text-severity-high" />
            )}
            <span
              className={cn("font-medium", isPositiveTrend ? "text-success" : "text-severity-high")}
            >
              {Math.abs(theme.trend)}%
            </span>
          </div>
        </div>

        <div>
          <CardTitle className="text-lg">{theme.name}</CardTitle>
          <CardDescription className="mt-1">{theme.summary}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[3px] w-full rounded-full bg-[hsl(var(--accent))] mb-3" />

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Recommended Actions</h4>
          <div className="space-y-2">
            {actions.map((action: Action) => (
              <div key={action.id} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                <div className={cn("p-1 rounded", action.kind === "product" ? "bg-primary/10" : "bg-accent/10")}>
                  {action.kind === "product" ? (
                    <Target className="h-3 w-3 text-primary" />
                  ) : (
                    <Rocket className="h-3 w-3 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{action.description}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <Badge variant="outline" className="text-[0.72rem]">
                      {action.kind.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Impact: {action.impact}/10 • Effort: {action.effort}/10
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}