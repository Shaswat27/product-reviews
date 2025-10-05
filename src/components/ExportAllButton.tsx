// src/components/ExportAllButton.tsx
"use client";
/*
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useSelectedProduct } from "@/app/providers/SelectedProductProvider"; 

export default function ExportAllButton({
  // productId prop is kept for data passing from Server Component
  productId, 
  fileBase = "insights",
  className,
  variant,
  size,
}: {
  productId?: string;
  fileBase?: string;
  className?: string;
  variant?: any;
  size?: any;
}) {
  // FIX: Read selected product from the context (the source of truth)
  const { productId: selectedProduct } = useSelectedProduct(); 

  if (!selectedProduct) {
    return (
      <Button 
            variant={variant || "outline"} 
            size={size || "sm"} 
            disabled 
            aria-disabled 
            title="Select a product to export" 
            className={className}
        >
        <Download className="h-4 w-4 mr-2" />
        Export All
      </Button>
    );
  }

  const href = `/insights/export?product=${encodeURIComponent(selectedProduct)}&fileBase=${encodeURIComponent(fileBase)}`;
  return (
    <Button asChild 
        variant={variant || "outline"} 
        size={size || "sm"} 
        title="Download JSON (server)" 
        className={className}
    >
      <Link href={href}>
        <Download className="h-4 w-4 mr-2" />
        Export All
      </Link>
    </Button>
  );
}
*/