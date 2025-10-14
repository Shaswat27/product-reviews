// src/components/DashboardHeader.tsx
import DashboardControls from "@/components/DashboardControls";

type Product = { id: string; name: string };

interface DashboardHeaderProps {
  productList: Product[];
}

export default function DashboardHeader({
  productList,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="leading-tight">
        <h1 className="text-xl font-semibold">SignalLens</h1>
        <p className="text-sm text-muted-foreground">Product Insights</p>
      </div>
      <DashboardControls productList={productList} />
    </header>
  );
}