// app/components/ExportAllButton.tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export default function ExportAllButton({
  productId,
  fileBase = "insights",
}: {
  productId?: string; // required in practice
  fileBase?: string;
}) {
  const params = useSearchParams();
  const selectedProduct = params.get("product") ?? productId;
  if (!selectedProduct) {
    return (
      <Button variant="outline" size="sm" disabled aria-disabled title="Select a product to export">
        <Download className="h-4 w-4 mr-2" />
        Export All
      </Button>
    );
  }

  const href = `/insights/export?product=${encodeURIComponent(selectedProduct)}&fileBase=${encodeURIComponent(fileBase)}`;
  return (
    <Button asChild variant="outline" size="sm" title="Download JSON (server)">
      <Link href={href}>
        <Download className="h-4 w-4 mr-2" />
        Export All
      </Link>
    </Button>
  );
}