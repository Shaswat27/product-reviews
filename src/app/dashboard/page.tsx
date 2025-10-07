export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { AlertTriangle, Clock } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

// Supabase
import { supabaseServerRead } from "@/lib/supabaseServerRead"

// Figma UI atoms
import { MetricCard } from "@/components/metric-card"
import { CompactMetricCard } from "@/components/compact-metric-card"
import { CustomerThemeCard } from "@/components/customer-theme-card"
import { TopActionsCard } from "@/components/top-actions-card"
import { cn } from "@/lib/utils"

// Figma header bridge
import DashboardHeader from "@/components/DashboardHeader"

type Severity = "high" | "medium" | "low"
type Product = { id: string; name: string; slug?: string }
type Action = {
  id: string
  theme_id: string
  kind: "product" | "gtm"
  description: string
  impact: number
  effort: number
  evidence?: Array<{ type: string; id: string; note?: string }>
}
type Theme = {
  id: string
  product_id: string
  name: string
  severity: Severity
  trend: number
  evidence_count: number
  summary: string
}
type TrendPoint = { week: string; themes: number }
type TrendRow = { week: string; themes: number }

const severityConfig = {
  high: { color: "severity-high", icon: AlertTriangle, label: "High" },
  medium: { color: "severity-medium", icon: Clock, label: "Medium" },
  low: { color: "severity-low", icon: Clock, label: "Low" },
} as const

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>
}) {
  const sp = await searchParams
  const q = Array.isArray(sp.product) ? sp.product[0] : sp.product

  // Load products from Supabase (authoritative)
  const supabase = await supabaseServerRead()
  const { data: themeProducts, error: themeProductsErr } = await supabase
    .from("themes")
    .select("product_id")
  if (themeProductsErr) throw themeProductsErr

  const productIds = Array.from(new Set((themeProducts ?? []).map(t => t.product_id))).filter(Boolean) as string[]
  const productList: Product[] = productIds.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }))
  const selectedId = q ?? productIds[0] // honor URL value even if not in DB

  // Filter by product
  const { data: themes, error: themesErr } = await supabase
    .from("themes")
    .select("id, product_id, name, severity, trend, evidence_count, summary")
    .eq("product_id", selectedId)
    .limit(5)
  if (themesErr) throw themesErr
  const themesArrRaw = (themes ?? []) as Theme[]
  const themesArr: Theme[] = themesArrRaw.filter(t => t.name !== "__cache__")

  // Actions
  const themeIds = themesArr.map((t: Theme) => t.id)
  let actionsArr: Action[] = []
  if (themeIds.length > 0) {
    const { data: actionsRaw, error: actionsErr } = await supabase
      .from("actions")
      .select("id, theme_id, kind, description, impact, effort, evidence")
      .in("theme_id", themeIds)
    if (actionsErr) throw actionsErr
    actionsArr = (actionsRaw ?? []).filter(a => a.description !== "__cache__") as Action[]
  }
  const actionsByTheme = actionsArr.reduce((acc, a) => {
    ;(acc[a.theme_id] ||= []).push(a)
    return acc
  }, {} as Record<string, Action[]>)

  // Trends
  let trends: TrendPoint[] = []
  const { data: trendRows, error: trendsErr } = await supabase
    .from("theme_trends")
    .select("week, themes")
    .eq("product_id", selectedId)
    .order("week", { ascending: true })
  if (!trendsErr && Array.isArray(trendRows)) {
    const trendRowsArr = (trendRows ?? []) as TrendRow[]
    trends = trendRowsArr.map(({ week, themes }: TrendRow) => ({ week, themes })) as TrendPoint[]
  }

  const evidencePoints = themesArr.reduce((sum: number, t: Theme) => sum + (t.evidence_count || 0), 0)
  const actionItems = actionsArr.length

  const themeNameById = new Map<string, string>(themesArr.map((t: Theme) => [t.id, t.name]))
  const topActions = actionsArr
    .map(a => ({ ...a, themeName: themeNameById.get(a.theme_id) ?? "Unknown" }))
    .map(a => ({ ...a, score: a.impact * 2 - a.effort }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const highSeverityCount = themesArr.filter((t: Theme) => t.severity === "high").length
  const confidencePct = Math.min(95, 70 + themesArr.length * 5)

  const figmaTopActions = topActions.map(a => ({
    title: a.description,
    description: `${a.kind.toUpperCase()} • ${a.themeName} • Impact ${a.impact}/5 • Effort ${a.effort}/5`,
  }))

  const hasActions = Array.isArray(figmaTopActions) && figmaTopActions.length > 0;
  console.log('hasActions', hasActions);
  return (
    // Do NOT re-wrap with container/max-w; root layout already handles width
    <div className="space-y-6 min-w-0 w-full">
      <DashboardHeader productList={productList} />

      {/* Metrics Grid */}
      <div className="lg:hidden">
        <div className="grid grid-cols-2 gap-2">
          <CompactMetricCard title="High Severity Issues" value={highSeverityCount} type="warning" />
          <CompactMetricCard title="Evidence Points" value={evidencePoints} type="info" />
          <CompactMetricCard title="Action Items" value={actionItems} type="success" />
          <CompactMetricCard title="Confidence Score" value={`${confidencePct}%`} type="primary" />
        </div>
      </div>

      <div className="hidden lg:grid grid-cols-4 gap-6">
        <MetricCard title="High Severity Issues" value={highSeverityCount} type="warning" />
        <MetricCard title="Evidence Points" value={evidencePoints} type="info" />
        <MetricCard title="Action Items" value={actionItems} type="success" />
        <MetricCard title="Confidence Score" value={`${confidencePct}%`} type="primary" />
      </div>

      {/* Content */}
      <div className="grid gap-8 xl:grid-cols-3 w-full min-w-0">
        {/* THEMES */}
        {/* This div is now always present, but its column span changes */}
        <div
          className={cn(
            "space-y-4 lg:space-y-6 w-full min-w-0",
            hasActions ? "xl:col-span-2" : "xl:col-span-3" // Spans full width if no actions
          )}
        >
          <h2 className="text-lg lg:text-xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Top Customer Themes
          </h2>

          {themesArr.length > 0 ? (
            themesArr.map((theme: Theme) => {
              const actions = actionsByTheme[theme.id] ?? []
              const avgImpact = actions.length ? actions.reduce((s, a) => s + (a.impact || 0), 0) / actions.length : 0
              const avgEffort = actions.length ? actions.reduce((s, a) => s + (a.effort || 0), 0) / actions.length : 0

              return (
                <CustomerThemeCard
                  key={theme.id}
                  title={theme.name}
                  description={theme.summary}
                  severity={severityConfig[theme.severity].label}
                  trend={`${theme.trend >= 0 ? "+" : "-"}${Math.abs(theme.trend)}%`}
                  recommendations={(actions ?? []).map(a => a.description)}
                  impact={`${avgImpact.toFixed(1)}/5`}
                  effort={`${avgEffort.toFixed(1)}/5`}
                />
              )
            })
          ) : (
            <Card className="w-full">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">No themes available for this product yet.</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ACTIONS */}
        {/* This div is now conditionally rendered */}
        {hasActions && (
          <div className="xl:col-span-1 space-y-4 lg:space-y-6 w-full min-w-0">
            <TopActionsCard
              title="Top Actions (This Quarter)"
              subtitle="Prioritized across this product's themes"
              actions={figmaTopActions}
            />
          </div>
        )}
      </div>
    </div>
  )
}