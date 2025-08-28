"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import products from "@/data/mock_products.json";

type Product = { id: string; name: string; slug: string };

const STORAGE_KEY = "selectedProductId";

export default function ProductPicker() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const list = products as Product[];
  const q = params.get("product");

  // Determine selected product from URL first; otherwise fall back to first item.
  const selected = useMemo(() => {
    if (q) {
      const fromUrl = list.find((p) => p.id === q);
      if (fromUrl) return fromUrl;
    }
    return list[0];
  }, [q, list]);

  // On first mount: if no ?product, try localStorage; otherwise ensure URL has a product.
  useEffect(() => {
    if (q) {
      // keep localStorage in sync when URL already has a selection
      try {
        window.localStorage.setItem(STORAGE_KEY, q);
      } catch {}
      return;
    }

    // no q in URL — try last remembered selection
    try {
      const last = window.localStorage.getItem(STORAGE_KEY);
      const valid = list.find((p) => p.id === last)?.id ?? list[0]?.id;
      if (valid) {
        const sp = new URLSearchParams(params.toString());
        sp.set("product", valid);
        router.replace(`${pathname}?${sp.toString()}`);
      }
    } catch {
      // if storage not available, just ensure we at least set first product in URL
      const fallback = list[0]?.id;
      if (fallback) {
        const sp = new URLSearchParams(params.toString());
        sp.set("product", fallback);
        router.replace(`${pathname}?${sp.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;

    // Update URL (preserves all other query params)
    const sp = new URLSearchParams(params.toString());
    sp.set("product", id);
    router.push(`${pathname}?${sp.toString()}`);

    // Mirror to localStorage (nice for reloads)
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product" className="text-sm text-muted-foreground">
        Product
      </label>
      <select
        id="product"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        value={selected?.id}
        onChange={onChange}
      >
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
    </div>
  );
}