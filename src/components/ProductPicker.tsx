// app/components/ProductPicker.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type Product = { id: string; name: string; slug?: string };
const STORAGE_KEY = "selectedProductId";
const EMPTY_PRODUCTS: Product[] = [];

export default function ProductPicker({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const list = products ?? EMPTY_PRODUCTS;
  const q = params.get("product");

  const selected = useMemo(() => {
    if (q) {
      const fromUrl = list.find((p) => p.id === q);
      if (fromUrl) return fromUrl;
    }
    return list[0];
  }, [q, list]);

  useEffect(() => {
    if (q) {
      try { window.localStorage.setItem(STORAGE_KEY, q); } catch {}
      return;
    }
    try {
      const last = window.localStorage.getItem(STORAGE_KEY);
      const valid = list.find((p) => p.id === last)?.id ?? list[0]?.id;
      if (valid) {
        const sp = new URLSearchParams(params.toString());
        sp.set("product", valid);
        router.replace(`${pathname}?${sp.toString()}`);
      }
    } catch {
      const fallback = list[0]?.id;
      if (fallback) {
        const sp = new URLSearchParams(params.toString());
        sp.set("product", fallback);
        router.replace(`${pathname}?${sp.toString()}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const sp = new URLSearchParams(params.toString());
    sp.set("product", id);
    router.push(`${pathname}?${sp.toString()}`);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch {}
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="product" className="text-sm text-muted-foreground">Product</label>
      <select
        id="product"
        className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        value={selected?.id}
        onChange={onChange}
      >
        {list.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}