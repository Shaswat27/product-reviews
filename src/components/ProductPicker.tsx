"use client";

import { useRouter, useSearchParams } from "next/navigation";
import products from "@/data/mock_products.json";
import { useMemo } from "react";

type Product = { id: string; name: string; slug: string };

export default function ProductPicker() {
  const router = useRouter();
  const params = useSearchParams();
  const current = params.get("product");
  const list = products as Product[];

  const selected = useMemo(
    () => list.find(p => p.id === current) ?? list[0],
    [current, list]
  );

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    const sp = new URLSearchParams(params.toString());
    sp.set("product", id);
    router.push(`?${sp.toString()}`);
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
        {list.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}