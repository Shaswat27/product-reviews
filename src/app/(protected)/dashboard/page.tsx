export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store';

import { TrendingUp, TrendingDown, AlertTriangle, Clock, Target, Rocket } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductPicker from "@/components/ProductPicker";

// Mocks
import productsJson from "@/data/mock_products.json";
import rawThemes from "@/data/mock_themes.json";
import mockTrendData from "@/data/mock_trends.json";
// import mockReviews from "@/data/mock_reviews.json";

// Chart
import ThemeTrends from "@/components/ThemeTrends";

type Severity = "critical" | "high" | "medium" | "low";
type Action = {
  id: string;
  type: "product" | "gtm";
  description: string;
  impact_score: number;
  effort_score: number;
};
type Theme = {
  id: string;
  product_id: string;
  name: string;
  severity: Severity;
  trend: number;
  evidence_count: number;
  summary: string;
  actions?: Action[];
};

type Trend = {
  product_id: string;
  week: string;      // ISO date string
  themes: number;    // count per week
};

type TrendPoint = { week: string; themes: number }; // what ThemeTrends wants

const severityConfig = {
  critical: { color: "severity-critical", icon: AlertTriangle, label: "Critical" },
  high:     { color: "severity-high",     icon: AlertTriangle, label: "High" },
  medium:   { color: "severity-medium",   icon: Clock,         label: "Medium" },
  low:      { color: "severity-low",      icon: Clock,         label: "Low" },
} as const;

function isTrend(x: unknown): x is Trend {
  return (
    typeof x === "object" &&
    x !== null &&
    "product_id" in x &&
    "week" in x &&
    "themes" in x
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  // ✅ Next.js (your version) requires awaiting searchParams in Server Components
  const sp = await searchParams;
  const q = Array.isArray(sp.product) ? sp.product[0] : sp.product;

  const products = productsJson as { id: string; name: string }[];
  const selectedId = q && products.some((p) => p.id === q) ? q : products[0].id;

  // Filter by product
  const allThemes = rawThemes as Theme[];
  const themes = allThemes.filter((t) => t.product_id === selectedId).slice(0, 5);

  const trends: TrendPoint[] = (mockTrendData as unknown[])
  .filter(isTrend) // optional; remove if you trust the JSON
  .filter((d) => d.product_id === selectedId)
  .map(({ week, themes }) => ({ week, themes }));
  // const reviewsCount = (mockReviews as any[]).filter((r) => r.product_id === selectedId).length;
  const evidencePoints = themes.reduce((sum, t) => sum + (t.evidence_count || 0), 0);
  const actionItems = themes.reduce((sum, t) => sum + (t.actions?.length || 0), 0);

  // Consolidated Top Actions (compact summary)
  const topActions = themes
    .flatMap((t) => (t.actions || []).map((a) => ({ ...a, themeName: t.name })))
    .map((a) => ({ ...a, score: a.impact_score - a.effort_score * 0.5 }))
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
        <ProductPicker />
      </div>

      {/* ===== Stats Overview ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-severity-critical" />
              <div>
                <p className="text-2xl font-bold">
                  {themes.filter((t) => t.severity === "critical").length}
                </p>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
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
            {themes.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
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
                    <div className={cn("p-1 rounded", a.type === "product" ? "bg-primary/10" : "bg-accent/10")}>
                      {a.type === "product" ? (
                        <Target className="h-3 w-3 text-primary" />
                      ) : (
                        <Rocket className="h-3 w-3 text-accent" />
                      )}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{a.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.type.toUpperCase()} • {a.themeName} • Impact {a.impact_score}/10 · Effort {a.effort_score}/10
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
}

function ThemeCard({ theme }: ThemeCardProps) {
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
                theme.severity === "critical" && "badge-critical",
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
              <TrendingDown className="h-4 w-4 text-severity-critical" />
            )}
            <span
              className={cn("font-medium", isPositiveTrend ? "text-success" : "text-severity-critical")}
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
            {(theme.actions ?? []).map((action: Action) => (
              <div key={action.id} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                <div className={cn("p-1 rounded", action.type === "product" ? "bg-primary/10" : "bg-accent/10")}>
                  {action.type === "product" ? (
                    <Target className="h-3 w-3 text-primary" />
                  ) : (
                    <Rocket className="h-3 w-3 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{action.description}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <Badge variant="outline" className="text-[0.72rem]">
                      {action.type.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Impact: {action.impact_score}/10 • Effort: {action.effort_score}/10
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