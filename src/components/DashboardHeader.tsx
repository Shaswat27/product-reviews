// src/components/DashboardHeader.tsx
"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { AppHeader } from "@/components/app-header";
import { useSidebar } from "@/components/Sidebar";
import ProductSearch from "@/components/ProductSearch";
import InsightsButton from "@/components/InsightsButton";
import { useSelectedProduct } from "@/app/providers/SelectedProductProvider";

type Product = { id: string; name: string; slug?: string };

interface DashboardHeaderProps {
  productList: Product[]; 
}

export default function DashboardHeader({
  productList,
}: DashboardHeaderProps): ReactElement {
  const { toggleSidebar } = useSidebar();
  
  const { productId } = useSelectedProduct(); 
  const nonNullableProductId = productId ?? "";

  const desktopRight = (
    <div className="flex items-center gap-2">
      {/* ProductSearch NO LONGER NEEDS initialProductId */}
      <ProductSearch fallbackOptions={productList} />
      <InsightsButton productId={nonNullableProductId} />
    </div>
  );

  const mobileRight = (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1">
        <ProductSearch fallbackOptions={productList} />
      </div>
      <InsightsButton productId={nonNullableProductId} />
    </div>
  );

  return (
    <AppHeader
      title=""
      subtitle=""
      onMenuClick={toggleSidebar}
      rightSlotDesktop={desktopRight}
      rightSlotMobile={mobileRight}
    />
  );
}