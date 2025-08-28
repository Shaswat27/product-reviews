"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProductId = string | null;

type Ctx = {
  productId: ProductId;
  setProductId: (id: ProductId) => void;
};

const SelectedProductContext = createContext<Ctx | undefined>(undefined);

export function SelectedProductProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL (?product=) or localStorage
  const [productId, setProductIdState] = useState<ProductId>(null);

  // hydrate from URL first, then localStorage
  useEffect(() => {
    const fromUrl = searchParams.get("product");
    if (fromUrl) {
      setProductIdState(fromUrl);
      return;
    }
    const fromStorage = typeof window !== "undefined" ? window.localStorage.getItem("selectedProductId") : null;
    if (fromStorage) setProductIdState(fromStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // setter that also syncs to localStorage and URL
  const setProductId = (id: ProductId) => {
    setProductIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem("selectedProductId", id);
      else window.localStorage.removeItem("selectedProductId");
    }
    // keep other params, just replace product
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("product", id);
    else params.delete("product");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const value = useMemo(() => ({ productId, setProductId }), [productId]);

  return (
    <SelectedProductContext.Provider value={value}>
      {children}
    </SelectedProductContext.Provider>
  );
}

export function useSelectedProduct() {
  const ctx = useContext(SelectedProductContext);
  if (!ctx) throw new Error("useSelectedProduct must be used within SelectedProductProvider");
  return ctx;
}