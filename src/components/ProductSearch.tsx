// src/components/ProductSearch.tsx
"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button"; // Retained for utility imports
import { Loader2, Search } from "lucide-react";
import { useSelectedProduct } from "@/app/providers/SelectedProductProvider";

interface ProductOption {
  id: string;
  name: string;
  domain?: string;
  logo?: string;
}

export default function ProductSearch({
  fallbackOptions,
}: {
  fallbackOptions: Array<{ id: string; name: string }>;
}) {
  const { productId, setProductId } = useSelectedProduct();
  const [open, setOpen] = React.useState(false);

  const [query, setQuery] = React.useState(productId || "");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<ProductOption[]>(fallbackOptions);
  const router = useRouter();
  const sp = useSearchParams();

  React.useEffect(() => {
    if (productId && query !== productId) {
      setQuery(productId);
    } else if (!productId && query) {
      setQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Debounced search with AbortController
  React.useEffect(() => {
    // ✅ 1. Create a new controller for this effect
    const controller = new AbortController();
    const signal = controller.signal;

    const q = query.trim();

    if (q.length < 3) {
      setResults(fallbackOptions);
      setLoading(false);
      return;
    }

    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/trustpilot/search?query=${encodeURIComponent(q)}&limit=6`,
          { signal } // ✅ 2. Pass the signal to fetch
        );
        if (!res.ok) throw new Error("search failed");
        const data = (await res.json()) as {
          items?: Array<{ name: string; url?: string; domain?: string; logo?: string }>;
        };
        const mapped: ProductOption[] = (data.items || []).map(i => ({
          id: i.domain || i.url || i.name,
          name: i.name,
          domain: i.domain,
          logo: i.logo,
        }));
        setResults(mapped);
      } catch (err: unknown) {
        // ✅ 3. Ignore the error if it was caused by our own abort call
        if ((err as Error).name === 'AbortError') {
          return;
        }
        // Keep fallback options if search fails for other reasons
        console.error("Search request failed:", err);
      } finally {
        setLoading(false);
      }
    }, 400);

    // ✅ 4. The cleanup function now also aborts the fetch
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, fallbackOptions]);

  const onSelect = (opt: ProductOption) => {
    setOpen(false);
    setProductId(opt.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 min-w-[280px]">
        <Search className="mr-2 h-4 w-4" />
        <span className="truncate">{productId || "Search products..."}</span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="z-50 w-[420px] p-0 rounded-md border border-border shadow-lg
                   !bg-white dark:!bg-neutral-900 !bg-opacity-100 !backdrop-blur-0"
      >
        <Command shouldFilter={false} className="rounded-md !bg-white dark:!bg-neutral-900">
          <CommandInput
            placeholder="Type to search Trustpilot…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="!bg-white dark:!bg-neutral-900 px-2 pb-2 pt-0">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching…
              </div>
            ) : (
              <>
                <CommandEmpty>No results.</CommandEmpty>
                <CommandGroup
                  heading="Results"
                  className="p-0 [&_[cmdk-group-heading]]:pt-0 [&_[cmdk-group-heading]]:pb-1.5"
                >
                  {results.map(r => (
                    <CommandItem
                      key={r.id}
                      onSelect={() => onSelect(r)}
                      className="cursor-pointer flex items-center gap-3"
                    >
                      {r.logo ? (
                        <img
                          src={r.logo}
                          alt={`${r.name} logo`}
                          className="h-5 w-5 rounded flex-shrink-0"
                        />
                      ) : (
                        <div className="h-5 w-5 rounded bg-muted flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">{r.name}</p>
                        {r.domain && (
                          <p className="truncate text-xs text-muted-foreground">{r.domain}</p>
                        )}
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
  );
}