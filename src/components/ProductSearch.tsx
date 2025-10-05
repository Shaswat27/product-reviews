// src/components/ProductSearch.tsx
"use client"
import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button" // Retained for utility imports
import { Loader2, Search } from "lucide-react"
import { useSelectedProduct } from "@/app/providers/SelectedProductProvider"

interface ProductOption { id: string; name: string; domain?: string; logo?: string }

// initialProductId prop is removed
export default function ProductSearch({ fallbackOptions }: { fallbackOptions: Array<{ id: string; name: string }> }) {
  const { productId, setProductId } = useSelectedProduct()
  const [open, setOpen] = React.useState(false)
  
  // FIX 1: Initialize query state with the current productId from context for persistence
  const [query, setQuery] = React.useState(productId || "") 
  const [loading, setLoading] = React.useState(false)
  const [results, setResults] = React.useState<ProductOption[]>(fallbackOptions)
  const router = useRouter()
  const sp = useSearchParams()

  // FIX 2: Sync internal query state with context state
  React.useEffect(() => {
    if (productId && query !== productId) {
      setQuery(productId)
    } else if (!productId && query) {
      setQuery("")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  // Debounced search to server API (logic unchanged)
  React.useEffect(() => {
    // ... existing search logic ...
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


  const onSelect = (opt: ProductOption) => {
    setOpen(false)
    // FIX 3: Use the context setter
    setProductId(opt.id)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* FIX 4: Structural fix for React.Children.only error */}
      <PopoverTrigger 
          className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 min-w-[280px] justify-start"
          >
        <Search className="mr-2 h-4 w-4" />
        <span className="truncate">{productId || "Search products..."}</span>
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
          <CommandList className="!bg-white dark:!bg-neutral-900 px-2 pb-2 pt-0">
            {/* ... rest of the content remains ... */}
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Searching…</div>
            ) : (
              <>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup heading="Results" className="p-0 [&_[cmdk-group-heading]]:pt-0 [&_[cmdk-group-heading]]:pb-1.5">
                {results.map(r => (
                  // FIX 2: Make the item a flex container with a gap for spacing
                    <CommandItem key={r.id} onSelect={() => onSelect(r)} className="cursor-pointer flex items-center gap-3">
                      
                      {/* FIX 3: Increase icon size */}
                      {r.logo ? (
                        <img src={r.logo} alt={`${r.name} logo`} className="h-5 w-5 rounded flex-shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded bg-muted flex-shrink-0" /> // Optional: Add a placeholder for items without logos
                      )}

                      {/* FIX 4: Add a wrapper div to handle flex growth and enable truncation */}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">{r.name}</p>
                        {r.domain && <p className="truncate text-xs text-muted-foreground">{r.domain}</p>}
                      </div>
                      
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