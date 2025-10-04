"use client"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCcw, Rocket } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

function getQuarterString(d = new Date()) {
  const m = d.getUTCMonth() // 0-11
  const q = Math.floor(m / 3)
  const y = d.getUTCFullYear()
  return `${y}Q${q}`
}

export default function InsightsButton({ productId }: { productId: string }) {
  const [loading, setLoading] = React.useState(false)
  const [label, setLabel] = React.useState<"generate" | "refresh">("generate")
  const [manifestId, setManifestId] = React.useState<string | null>(null)
  const router = useRouter()

  const quarter = getQuarterString()

  React.useEffect(() => {
    let ignore = false
    async function check() {
      try {
        const res = await fetch("/api/insights/manifests")
        if (!res.ok) throw new Error("manifests fetch failed")
        const items = (await res.json()) as Array<{ id: string; business_unit_id: string; quarter: string }>
        const m = items.find(r => r.business_unit_id === productId && r.quarter === quarter) || null
        if (!ignore) {
          setManifestId(m?.id ?? null)
          setLabel(m ? "refresh" : "generate")
        }
      } catch {
        // best-effort; default to generate
      }
    }
    check()
    return () => { ignore = true }
  }, [productId, quarter])

  const run = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/ingest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessUnitId: productId, quarter })
      })
      if (!res.ok) throw new Error("ingest failed")
      const data = await res.json()
      const id = data?.manifestId as string | undefined

      // Kick recompute for metrics/trends if we have a manifest id
      const manifest = id || manifestId
      if (manifest) {
        await fetch("/api/insights/recompute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest_id: manifest })
        })
      }

      toast("Insights ready", {description: "Themes & actions created."})
      router.refresh()
    } catch (e) {
      toast("Failed to run insights",{ description: (e as Error).message})
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button onClick={run} disabled={loading} className="gap-2">
      {loading ? (
        <><Loader2 className="h-4 w-4 animate-spin" />Working…</>
      ) : label === "generate" ? (
        <><Rocket className="h-4 w-4" />Generate Insights</>
      ) : (
        <><RefreshCcw className="h-4 w-4" />Refresh Insights</>
      )}
    </Button>
  )
}