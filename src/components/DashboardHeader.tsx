// src/components/DashboardHeader.tsx
import DashboardControls from "./DashboardControls";

type Product = { id: string; name: string };

interface DashboardHeaderProps {
  productList: Product[];
  selectedProductName?: string;
}

export default function DashboardHeader({
  productList,
  selectedProductName,
}: DashboardHeaderProps) {
  const displayName = selectedProductName?.toLowerCase().startsWith("www.")
    ? selectedProductName.slice(4)
    : selectedProductName;
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <img
          src="/logo.png"
          alt="SignalLens Logo"
          className="h-12 object-contain" // Slightly reduced size for better balance
        />
        <div className="leading-tight">
          <div className="flex items-baseline gap-x-2">
            {/* App Name */}
            <h1 className="text-xl lg:text-2xl font-semibold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              SignalLens
            </h1>

            {/* Separator and Context (Product Name) */}
            {selectedProductName && (
              <>
                <span className="text-xl lg:text-2xl font-light text-muted-foreground">/</span>
                <span className="text-lg lg:text-xl font-semibold text-foreground">
                  {displayName}
                </span>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            Product Insights from Top Trustpilot Review Pages
          </p>
        </div>
      </div>
      <DashboardControls productList={productList} />
    </header>
  );
}