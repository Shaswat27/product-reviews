"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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

  // Hydrate from URL first, else localStorage; re-run if URL changes (e.g., back/forward)
  useEffect(() => {
    const fromUrl = searchParams.get("product");
    if (fromUrl) {
      setProductIdState(fromUrl);
      return;
    }
    const fromStorage =
      typeof window !== "undefined"
        ? window.localStorage.getItem("selectedProductId")
        : null;
    if (fromStorage) setProductIdState(fromStorage);
  }, [searchParams]);

  // Stable setter that also syncs to localStorage and URL
  const setProductId = useCallback(
    (id: ProductId) => {
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
    },
    [router, pathname, searchParams]
  );

  const value = useMemo(() => ({ productId, setProductId }), [productId, setProductId]);

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