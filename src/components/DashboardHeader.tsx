"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { AppHeader } from "@/components/app-header";
import { useSidebar } from "@/components/Sidebar";
import ProductSearch from "@/components/ProductSearch";
import InsightsButton from "@/components/InsightsButton";

type Product = { id: string; name: string; slug?: string };

interface DashboardHeaderProps {
  selectedId: string;
  productList: Product[];
}

export default function DashboardHeader({
  selectedId,
  productList,
}: DashboardHeaderProps): ReactElement {
  const { toggleSidebar } = useSidebar();

  const desktopRight = (
    <div className="flex items-center gap-2">
      {/* force remount on product change to reset internal state */}
      <ProductSearch key={`ps-${selectedId}`} initialProductId={selectedId} fallbackOptions={productList} />
      <InsightsButton key={`ib-${selectedId}`} productId={selectedId} />
    </div>
  );

  const mobileRight = (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1">
        <ProductSearch key={`psm-${selectedId}`} initialProductId={selectedId} fallbackOptions={productList} />
      </div>
      <InsightsButton key={`ibm-${selectedId}`} productId={selectedId} />
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