export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

import { TrendingUp, TrendingDown, AlertTriangle, Clock, Target, Rocket } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
// Removed ProductPicker + per-theme GenerateActionsButton
import ProductSearch from "@/components/ProductSearch"
import InsightsButton from "@/components/InsightsButton"

// Supabase
import { supabaseServerRead } from "@/lib/supabaseServerRead"

// Chart
import ThemeTrends from "@/components/ThemeTrends"

type Severity = "high" | "medium" | "low"
type Product = { id: string; name: string; slug?: string }
type Action = {
  id: string
  theme_id: string
  kind: "product" | "gtm"
  description: string
  impact: number // 1-5 in DB
  effort: number // 1-5 in DB
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
// ---- Supabase row helpers ----
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
    .order("product_id", { ascending: true })
  if (themeProductsErr) throw themeProductsErr
  const productIds = Array.from(new Set((themeProducts ?? []).map(t => t.product_id))).filter(Boolean) as string[]
  const productList: Product[] = productIds.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }))
  const selectedId = q ?? productIds[0]  // honor the URL value even if not in DB

  // Filter by product
  const { data: themes, error: themesErr } = await supabase
    .from("themes")
    .select("id, product_id, name, severity, trend, evidence_count, summary")
    .eq("product_id", selectedId)
    .limit(5)
  if (themesErr) throw themesErr
  const themesArrRaw = (themes ?? []) as Theme[]
  // Exclude cache sentinel rows
  const themesArr: Theme[] = themesArrRaw.filter(t => t.name !== "__cache__")

  // Actions for those themes
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

  // Trends (keep existing weekly view if available)
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

  // Consolidated Top Actions (compact summary)
  const themeNameById = new Map<string, string>(themesArr.map((t: Theme) => [t.id, t.name]))
  const topActions = actionsArr
    .map(a => ({ ...a, themeName: themeNameById.get(a.theme_id) ?? "Unknown" }))
    .map(a => ({ ...a, score: a.impact * 2 - a.effort }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  return (
    <div className="container mx-auto max-w-7xl space-y-6">
      {/* ===== Header with Product Search + Global Insights Button ===== */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold heading-accent">
            <span className="text-[hsl(var(--primary))]">SignalLens</span>
            <span className="text-[hsl(var(--foreground))]"> Dashboard</span>
          </h1>
          <p className="body-ink -mt-1">Latest insights for the selected product</p>
        </div>
        <div className="flex items-center gap-2">
          <ProductSearch initialProductId={selectedId} fallbackOptions={productList} />
          <InsightsButton productId={selectedId} />
        </div>
      </div>

      {/* ===== Stats Overview ===== */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-severity-high" />
              <div>
                <p className="text-2xl font-bold">{themesArr.filter((t: Theme) => t.severity === "high").length}</p>
                <p className="text-sm text-muted-foreground">High Severity Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-3d stat-card">
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
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
              <Target className="h-5 w-5" />
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
              <Rocket className="h-5 w-5" />
              <div>
                <p className="text-2xl font-bold">{Math.min(95, 70 + themesArr.length * 5)}%</p>
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
            {/* Removed View All Themes button per new flow */}
          </div>

          <div className="space-y-4">
            {themesArr.map((theme: Theme) => (
              <ThemeCard key={theme.id} theme={theme} actions={actionsByTheme[theme.id] ?? []} />
            ))}
          </div>
        </div>

        {/* Trends + Top Actions */}
        <div className="space-y-4">
          <Card className="card-3d stat-card">
            <CardHeader>
              <CardTitle className="text-base">Top Actions (This Quarter)</CardTitle>
              <CardDescription className="body-ink">Prioritized across this product’s themes</CardDescription>
            </CardHeader>
            <CardContent>
              {topActions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions yet.</p>
              ) : (
                topActions.map(a => (
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
                      <div className="text-xs text-muted-foreground">{a.kind.toUpperCase()} • {a.themeName} • Impact {a.impact}/5 · Effort {a.effort}/5</div>
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
  )
}

/* ===== Theme Card ===== */
interface ThemeCardProps {
  theme: Theme
  actions: Action[]
}

function ThemeCard({ theme, actions }: ThemeCardProps) {
  const severity = severityConfig[theme.severity]
  const SeverityIcon = severity.icon
  const isPositiveTrend = theme.trend >= 0

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
            {/* Removed evidence count badge per new flow */}
          </div>

          <div className="flex items-center space-x-1 text-sm">
            {isPositiveTrend ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-severity-high" />}
            <span className={cn("font-medium", isPositiveTrend ? "text-success" : "text-severity-high")}>{Math.abs(theme.trend)}%</span>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{theme.name}</CardTitle>
            {/* Removed per-theme GenerateActionsButton */}
          </div>
          <CardDescription className="mt-1">{theme.summary}</CardDescription>
        </div>
      </CardHeader>

      <CardContent>
        <div className="h-[3px] w-full rounded-full bg-[hsl(var(--accent))] mb-3" />

        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Recommended Actions</h4>
          <div className="space-y-2">
            {actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recommended actions yet for this theme.</p>
            ) : (
              actions.map((action: Action) => (
                <div key={action.id} className="flex items-start gap-2 p-3 bg-secondary rounded-lg">
                  <div className={cn("p-1 rounded", action.kind === "product" ? "bg-primary/10" : "bg-accent/10")}>
                    {action.kind === "product" ? <Target className="h-3 w-3 text-primary" /> : <Rocket className="h-3 w-3 text-accent" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{action.description}</p>
                    <div className="mt-1 flex items-center gap-3">
                      <Badge variant="outline" className="text-[0.72rem]">{action.kind.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">Impact: {action.impact}/5 • Effort: {action.effort}/5</span>
                      {/* Removed evidence snippet line */}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}