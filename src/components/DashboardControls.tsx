"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Settings, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/components/ui/toast";
import ProductSearch from "@/components/ProductSearch";
import { get } from "http";

type Product = { id: string; name: string };

interface DashboardControlsProps {
  productList: Product[];
}

function getQuarterString(d = new Date()) {
  const m = d.getUTCMonth() // 0-11
  const q = Math.floor(m / 3)+1
  const y = d.getUTCFullYear()
  return `${y}Q${q}`
}

export default function DashboardControls({
  productList,
}: DashboardControlsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const selectedId = searchParams.get("product") ?? productList[0]?.id;
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [reviewCount, setReviewCount] = React.useState([100]);

  const handleGenerateClick = async () => {
    if (!selectedId) {
      toast({
        variant: "destructive",
        title: "No Product Selected",
        description: "Please select a product to generate insights.",
      });
      return;
    }
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ingest/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessUnitId: selectedId,
          quarter: getQuarterString(),
          limit: reviewCount[0],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate insights.");
      }

      toast({
        title: "Insights Generated",
        description: "The dashboard will now reflect the latest data.",
      });
      router.refresh();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred.";
      toast({
        variant: "destructive",
        title: "Error Generating Insights",
        description: errorMessage,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    // The h1 title is removed from here. This component is now just for controls.
    <div className="flex w-full items-center gap-2 md:w-auto">
      <div className="flex-1 min-w-0">
        <ProductSearch fallbackOptions={productList} />
      </div>

      <Button onClick={handleGenerateClick} disabled={isGenerating}>
        {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Generate Insight
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="grid gap-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Settings</h4>
              <p className="text-sm text-muted-foreground">
                Adjust the insight generation parameters.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="review-count">Review Count</Label>
              <div className="flex items-center gap-3">
                <Slider
                  id="review-count"
                  min={50}
                  max={200}
                  step={10}
                  value={reviewCount}
                  onValueChange={setReviewCount}
                  className="flex-1"
                />
                <span className="text-sm font-medium w-8 text-center bg-muted rounded-md py-1">
                  {reviewCount[0]}
                </span>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}