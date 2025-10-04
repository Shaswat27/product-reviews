"use client"
import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"

interface ProductOption { id: string; name: string; domain?: string; logo?: string }

export default function ProductSearch({ initialProductId, fallbackOptions }: { initialProductId?: string; fallbackOptions: Array<{ id: string; name: string }> }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<ProductOption[]>(fallbackOptions)
  const router = useRouter()
  const sp = useSearchParams()

  // Debounced search to server API
  React.useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults(fallbackOptions)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/trustpilot/search?query=${encodeURIComponent(q)}&limit=6`)
        if (!res.ok) throw new Error("search failed")
        const data = (await res.json()) as { items?: Array<{ name: string; url?: string; domain?: string; logo?: string }> }
        const mapped: ProductOption[] = (data.items || []).map(i => ({ id: i.domain || i.url || i.name, name: i.name, domain: i.domain, logo: i.logo }))
        setResults(mapped)
      } catch {
        // Keep fallback options if search fails
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, fallbackOptions])

  const selected = initialProductId

  const onSelect = (opt: ProductOption) => {
    setOpen(false)
    const params = new URLSearchParams(sp?.toString())
    params.set("product", opt.id)
    router.push(`?${params.toString()}`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[280px] justify-start">
          <Search className="mr-2 h-4 w-4" />
          <span className="truncate">{selected || "Search products..."}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
          align="end"
          side="bottom"
          className="z-50 w-[420px] p-0 rounded-md border border-border shadow-lg
             !bg-white dark:!bg-neutral-900 !bg-opacity-100 !backdrop-blur-0"
        >
        <Command
        shouldFilter={false}
        className="rounded-md !bg-white dark:!bg-neutral-900"
        >
          <CommandInput placeholder="Type to search Trustpilot…" value={query} onValueChange={setQuery} />
          <CommandList className="!bg-white dark:!bg-neutral-900">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Searching…</div>
            ) : (
              <>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Results" className="bg-transparent">
                  {results.map(r => (
                    <CommandItem key={r.id} onSelect={() => onSelect(r)} className="cursor-pointer">
                      {r.logo ? <img src={r.logo} alt="" className="h-4 w-4 mr-2 rounded" /> : null}
                      <span className="truncate">{r.name}</span>
                      {r.domain ? <span className="ml-2 text-xs text-muted-foreground">{r.domain}</span> : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}