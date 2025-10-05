// app/insights/page.tsx

'use client'; // This page is now a Client Component to manage state

import React, { useState, useEffect } from 'react';

// Original and new imports
import { supabaseBrowser } from "@/lib/supabaseBrowser"; // Use client Supabase
import DashboardHeader from "@/components/DashboardHeader";
// import ExportAllButton from "@/components/ExportAllButton";
import { ThemeTrendCard, type ThemeTrend } from "@/components/theme-trend-card"; // Import the new card

// UI imports
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Download, Eye, BarChart2 } from "lucide-react";
import { useSearchParams } from 'next/navigation';

// --- TYPE DEFINITIONS ---
type InsightReport = { id: string; product_id: string; title: string; summary: string; date: string; };
type Product = { id: string; name: string; slug?: string };
type Manifest = { manifest_id: string; name: string; };

// --- DUMMY DATA FOR API SIMULATION ---
const DUMMY_MANIFESTS: Manifest[] = [
  { manifest_id: 'q4-2025-final', name: 'Q4 2025' },
  { manifest_id: 'q3-2025-final', name: 'Q3 2025' },
  { manifest_id: 'q2-2025-final', name: 'Q2 2025' },
];
const DUMMY_TRENDS_DATA: { [key: string]: ThemeTrend[] } = {
  'q4-2025-final': [
    { name: 'Onboarding Flow', description: 'User feedback regarding the initial setup process and tutorials.', current_severity: 'High', delta_reviews: 32 },
    { name: 'API Rate Limits', description: 'Developers hitting rate limits more frequently during peak hours.', current_severity: 'Medium', delta_reviews: 15 },
    { name: 'Dashboard UI', description: 'General comments on the new user interface released last quarter.', current_severity: 'Low', delta_reviews: -22 },
  ],
  'q3-2025-final': [
    { name: 'Billing Issues', description: 'Reports of incorrect invoices and subscription renewal problems.', current_severity: 'High', delta_reviews: 8 },
    { name: 'Performance Glitches', description: 'Users experiencing lag and slow response times in the editor.', current_severity: 'Medium', delta_reviews: -5 },
  ],
  'q2-2025-final': [], // Example of a quarter with no data
};


// --- THE MAIN PAGE COMPONENT ---
export default function Insights() {
  const searchParams = useSearchParams();
  
  // State for original "Recent Reports" feature
  const [productList, setProductList] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [reports, setReports] = useState<InsightReport[]>([]);
  
  // State for new "Quarterly Trends" feature
  const [manifests, setManifests] = useState<Manifest[]>([]);
  const [selectedManifestId, setSelectedManifestId] = useState<string | null>(null);
  const [trends, setTrends] = useState<ThemeTrend[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(true);

  // Effect for fetching initial data (products and reports)
  useEffect(() => {
    const fetchInitialData = async () => {
      const supabase = supabaseBrowser();
      const { data: pr, error: prErr } = await supabase.from("insight_reports").select("product_id").order("product_id", { ascending: true });
      if (prErr) { console.error(prErr); return; }
      
      const productIds = Array.from(new Set((pr ?? []).map((r: { product_id: string }) => r.product_id))).filter(Boolean) as string[];
      const products: Product[] = productIds.map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
      setProductList(products);

      const q = searchParams.get('product');
      const currentProductId = (q && productIds.includes(q)) ? q : productIds[0];
      setSelectedProductId(currentProductId);

      if (currentProductId) {
        const { data: reportData, error: reportsErr } = await supabase.from("insight_reports").select("id, product_id, title, summary, date:week_start::date").eq("product_id", currentProductId).order("week_start", { ascending: false });
        if (reportsErr) { console.error(reportsErr); return; }
        setReports(reportData || []);
      }
    };
    fetchInitialData();
  }, [searchParams]);

  // Effect for fetching manifests list
  useEffect(() => {
    // API Call Placeholder: GET /api/insights/manifests
    const fetchManifests = () => {
      setManifests(DUMMY_MANIFESTS);
      if (DUMMY_MANIFESTS.length > 0) {
        setSelectedManifestId(DUMMY_MANIFESTS[0].manifest_id);
      }
    };
    fetchManifests();
  }, []);

  // Effect for fetching trends when a manifest is selected
  useEffect(() => {
    if (!selectedManifestId) return;
    setIsLoadingTrends(true);
    // API Call Placeholder: GET /api/insights/trends
    const fetchTrends = () => {
      // Simulate network delay
      setTimeout(() => {
        setTrends(DUMMY_TRENDS_DATA[selectedManifestId] || []);
        setIsLoadingTrends(false);
      }, 500);
    };
    fetchTrends();
  }, [selectedManifestId]);
  
  return (
    <div className="space-y-8 w-full">
      <DashboardHeader productList={productList} />

      {/* --- NEW: Quarterly Themes & Trend History Section --- */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
                <BarChart2 className="h-6 w-6" />
                <h2 className="text-lg font-semibold">Quarterly Themes & Trend History</h2>
            </div>
            <Select value={selectedManifestId ?? ''} onValueChange={setSelectedManifestId} disabled={manifests.length === 0}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select Quarter" />
                </SelectTrigger>
                <SelectContent>
                    {manifests.map((m) => <SelectItem key={m.manifest_id} value={m.manifest_id}>{m.name}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        
        {isLoadingTrends ? (
            <p className="text-center text-muted-foreground py-10">Loading trends...</p>
        ) : trends.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {trends.map((theme) => <ThemeTrendCard key={theme.name} theme={theme} />)}
            </div>
        ) : (
             <Card className="border-border/50 backdrop-blur-sm">
                <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No trend data available for this quarter.</p>
                </CardContent>
            </Card>
        )}
      </div>

      
    </div>
  );
}

// ReportCard component remains the same
function ReportCard({ report }: { report: InsightReport }) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return (
    <Card className="transition-all hover:shadow-md">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{report.title}</CardTitle>
            <CardDescription className="mt-1">{report.summary}</CardDescription>
            <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /><span>{formatDate(report.date)}</span>
            </div>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="outline" size="sm"><Eye className="mr-1 h-4 w-4" />View</Button>
            <Button variant="outline" size="sm"><Download className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}