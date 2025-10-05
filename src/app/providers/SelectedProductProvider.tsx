"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
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

  // Initialize BEFORE first paint to avoid flicker
  const [productId, setProductIdState] = useState<ProductId>(() => {
    if (typeof window === "undefined") return null;
    const fromUrl = new URLSearchParams(window.location.search).get("product");
    if (fromUrl) return fromUrl;
    const fromStorage = window.localStorage.getItem("selectedProductId");
    return fromStorage ?? null;
  });

  // Keep state in sync when the URL changes (e.g., back/forward)
  useEffect(() => {
    const fromUrl = searchParams.get("product");
    if (fromUrl !== productId) {
      setProductIdState(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); // URL is the source of truth on navigation

  const setProductId = useCallback(
    (id: ProductId) => {
      setProductIdState(id);

      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem("selectedProductId", id);
        else window.localStorage.removeItem("selectedProductId");
      }

      // preserve other params, just update/remove product
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set("product", id);
      else params.delete("product");

      const query = params.toString();
      const url = query ? `${pathname}?${query}` : pathname;

      // avoid blocking render and avoid scroll jump
      startTransition(() => {
        router.replace(url, { scroll: false });
      });
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