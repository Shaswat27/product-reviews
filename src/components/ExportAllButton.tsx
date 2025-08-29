"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export type InsightReport = {
  id: string;
  product_id: string;
  status: "completed" | "draft";
  themes_count: number;
  title: string;
  summary: string;
  date: string;
};

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportAllButton({
  reports,
  productId,
  fileBase = "insights",
}: {
  /** Optional: client fallback data (current page). */
  reports?: InsightReport[];
  /** Preferred: server export for full filtered dataset. */
  productId?: string;
  fileBase?: string;
}) {
  // Client-fallback filename (only used if no productId/server route)
  const fallbackFilename = useMemo(() => {
    const product = reports?.[0]?.product_id ?? "all";
    const latestDate =
      reports && reports.length
        ? reports.map((r) => r.date).sort().slice(-1)[0]
        : new Date().toISOString().slice(0, 10);
    return `${fileBase}-${product}-${latestDate}.json`;
  }, [reports, fileBase]);

  // Prefer server route if productId is provided (future-proof for server filtering/pagination)
  if (productId) {
    const href = `/insights/export?product=${encodeURIComponent(productId)}`;
    return (
      <Button asChild variant="outline" size="sm" title="Download JSON (server)">
        <Link href={href}>
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Link>
      </Button>
    );
  }

  // Fallback: export what we have on the client (e.g., mock or current page)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => reports?.length && downloadJSON(fallbackFilename, reports)}
      disabled={!reports?.length}
      aria-disabled={!reports?.length}
      title={reports?.length ? "Download JSON" : "No reports to export"}
    >
      <Download className="h-4 w-4 mr-2" />
      Export All
    </Button>
  );
}