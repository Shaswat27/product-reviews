// components/GenerateActionsButton.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type Props = { themeId: string };

export default function GenerateActionsButton({ themeId }: Props) {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: themeId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      router.refresh(); // pull new actions
    } catch (e) {
      console.error(e);
      alert(`Synthesis failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm" className="cursor-pointer">
      {loading ? "Generating…" : "Generate Actions"}
    </Button>
  );
}