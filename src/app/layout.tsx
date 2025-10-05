// app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import { SelectedProductProvider } from "./providers/SelectedProductProvider";
import ClientToaster from "@/components/ClientToaster";

// ✅ bring in your existing Sidebar context provider
import { SidebarProvider } from "@/components/Sidebar";

// ✅ use the adapter that renders the Figma sidebar + wires router/state
import AppSidebar from "@/components/AppSidebar";

export const metadata = {
  title: "SignalLens",
  description: "Product review and customer feedback analysis tool",
  other: {
    "trustpilot-one-time-domain-verification-id":
      "4784bee8-c43b-44a3-bf3c-73cf39b417d0",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Suspense fallback={<div className="p-4 text-sm opacity-60">Loading…</div>}>
          <SelectedProductProvider>
            {/* ✅ SidebarProvider supplies open/collapsed/cookies + mobile sheet state */}
            <SidebarProvider defaultOpen>
              {/* 16rem sidebar + fluid content on desktop; overlay on mobile */}
            <div className="min-h-screen flex-1 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
              {/* Sidebar column */}
              <AppSidebar />

              {/* Content column */}
              <main className="bg-background text-foreground min-w-0">
                {/* no max-width cap so it won’t look narrow; adjust padding as you like */}
                <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">      
                  <Suspense fallback={<div className="text-sm opacity-60">Loading…</div>}>
                      {children}
                    </Suspense>
                  </div>
                </main>
              </div>

              {/* 🔔 Global toast portal */}
              <ClientToaster />
            </SidebarProvider>
          </SelectedProductProvider>
        </Suspense>
      </body>
    </html>
  );
}