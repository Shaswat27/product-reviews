export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

import { AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

// Supabase
import { supabaseServerRead } from "@/lib/supabaseServerRead";

// UI Components
import { MetricCard } from "@/components/metric-card";
import { CompactMetricCard } from "@/components/compact-metric-card";
import { CustomerThemeCard } from "@/components/customer-theme-card";
import { TopActionsCard } from "@/components/top-actions-card";
import { cn } from "@/lib/utils";
import DashboardHeader from "@/components/DashboardHeader"; // Import the new header

// Type definitions remain the same
type Severity = "high" | "medium" | "low";
type Product = { id: string; name: string; slug?: string };
type Action = {
  id: string;
  theme_id: string;
  kind: "product" | "gtm";
  description: string;
  impact: number;
  effort: number;
  evidence?: Array<{ type: string; id: string; note?: string }>;
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
type TrendPoint = { week: string; themes: number };
type TrendRow = { week: string; themes: number };

const severityConfig = {
  high: { color: "severity-high", icon: AlertTriangle, label: "High" },
  medium: { color: "severity-medium", icon: Clock, label: "Medium" },
  low: { color: "severity-low", icon: Clock, label: "Low" },
} as const;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>;
}) {
  const sp = await searchParams;
  const q = Array.isArray(sp.product) ? sp.product[0] : sp.product;

  // Data fetching logic remains the same
  const supabase = await supabaseServerRead();
  const { data: themeProducts, error: themeProductsErr } = await supabase
    .from("themes")
    .select("product_id");
  if (themeProductsErr) throw themeProductsErr;

  const productIds = Array.from(
    new Set((themeProducts ?? []).map((t) => t.product_id))
  ).filter(Boolean) as string[];
  const productList: Product[] = productIds.map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
  }));
  const selectedId = q ?? productIds[0];

  // 4. Find the selected product to pass its name to the header
  const selectedProduct = productList.find((p) => p.id === selectedId);

  const { data: themes, error: themesErr } = await supabase
    .from("themes")
    .select("id, product_id, name, severity, trend, evidence_count, summary")
    .eq("product_id", selectedId)
    .limit(5);
  if (themesErr) throw themesErr;
  const themesArrRaw = (themes ?? []) as Theme[];
  const themesArr: Theme[] = themesArrRaw.filter((t) => t.name !== "__cache__");

  const themeIds = themesArr.map((t: Theme) => t.id);
  let actionsArr: Action[] = [];
  if (themeIds.length > 0) {
    const { data: actionsRaw, error: actionsErr } = await supabase
      .from("actions")
      .select("id, theme_id, kind, description, impact, effort, evidence")
      .in("theme_id", themeIds);
    if (actionsErr) throw actionsErr;
    actionsArr = (actionsRaw ?? []).filter(
      (a) => a.description !== "__cache__"
    ) as Action[];
  }
  const actionsByTheme = actionsArr.reduce(
    (acc, a) => {
      (acc[a.theme_id] ||= []).push(a);
      return acc;
    },
    {} as Record<string, Action[]>
  );

  const evidencePoints = themesArr.reduce(
    (sum: number, t: Theme) => sum + (t.evidence_count || 0),
    0
  );
  const actionItems = actionsArr.length;
  const themeNameById = new Map<string, string>(
    themesArr.map((t: Theme) => [t.id, t.name])
  );
  const topActions = actionsArr
    .map((a) => ({
      ...a,
      themeName: themeNameById.get(a.theme_id) ?? "Unknown",
    }))
    .map((a) => ({ ...a, score: a.impact * 2 - a.effort }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const highSeverityCount = themesArr.filter(
    (t: Theme) => t.severity === "high"
  ).length;
  const rawConfidence = Math.min(95, 39 * Math.log(evidencePoints + 1));
  const confidencePct = rawConfidence.toFixed(0);
  const figmaTopActions = topActions.map((a) => ({
    title: a.description,
    description: `${a.kind.toUpperCase()} • ${a.themeName} • Impact ${
      a.impact
    }/5 • Effort ${a.effort}/5`,
  }));
  const hasActions =
    Array.isArray(figmaTopActions) && figmaTopActions.length > 0;

  return (
  // Add the container with padding here to wrap the entire page
  <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
    <div className="space-y-6">
      {/* Use the new DashboardHeader component */}
      <DashboardHeader
        productList={productList}
        selectedProductName={selectedProduct?.name}
      />

      {/* Metrics Grid (no changes needed here) */}
      <div className="lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          <CompactMetricCard
            title="High Severity Issues"
            value={highSeverityCount}
            type="warning"
          />
          <CompactMetricCard
            title="Evidence Points"
            value={evidencePoints}
            type="info"
          />
          <CompactMetricCard
            title="Action Items"
            value={actionItems}
            type="success"
          />
          <CompactMetricCard
            title="Confidence Score"
            value={`${confidencePct}%`}
            type="primary"
          />
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-4 gap-6">
        <MetricCard
          title="High Severity Issues"
          value={highSeverityCount}
          type="warning"
        />
        <MetricCard title="Evidence Points" value={evidencePoints} type="info" />
        <MetricCard title="Action Items" value={actionItems} type="success" />
        <MetricCard
          title="Confidence Score"
          value={`${confidencePct}%`}
          type="primary"
        />
      </div>

      {/* Content (no changes needed here) */}
      <div className="grid gap-8 xl:grid-cols-3 w-full">
        <div
          className={cn(
            "space-y-4 lg:space-y-6 w-full",
            hasActions ? "xl:col-span-2" : "xl:col-span-3"
          )}
        >
          <h2 className="text-xl lg:text-2xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Top Customer Themes
          </h2>

          {themesArr.length > 0 ? (
            themesArr.map((theme: Theme) => {
              const actions = actionsByTheme[theme.id] ?? [];
              return (
                <CustomerThemeCard
                  key={theme.id}
                  title={theme.name}
                  description={theme.summary}
                  severity={severityConfig[theme.severity].label}
                  evidenceCount={theme.evidence_count || 0}
                  recommendations={actions}
                />
              );
            })
          ) : (
            <Card className="w-full">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  No themes available for this product yet.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {hasActions && (
          <div className="xl:col-span-1 space-y-4 lg:space-y-6 w-full">
            <TopActionsCard
              title="Top 3 Product & GTM Actions"
              actions={figmaTopActions}
            />
          </div>
        )}
      </div>
    </div>
  </div>
  );
}