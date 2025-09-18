// app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import SidebarItems from "./SidebarItems";
import { SelectedProductProvider } from "./providers/SelectedProductProvider";


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
        {/* NEW: ensure any hook usage inside the provider is behind Suspense */}
        <Suspense fallback={<div className="p-4 text-sm opacity-60">Loading…</div>}>
          <SelectedProductProvider>
            <div className="flex min-h-screen">
              {/* Sidebar */}
              <aside className="w-64 shrink-0 border-r bg-card">
                <div className="px-4 py-4">
                  <div className="text-xl font-bold heading-accent tracking-tight">SignalLens</div>
                  <div className="brand-underline mt-1" />
                  <div className="text-xs body-ink -mt-0.1">Product Insights</div>
                </div>

                {/* already Suspense-wrapped (kept) */}
                <Suspense fallback={<div className="px-4 py-2 text-sm opacity-60">Loading…</div>}>
                  <SidebarItems />
                </Suspense>
              </aside>

              {/* Main */}
              <main className="flex-1 bg-background text-foreground">
                <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                  {/* already Suspense-wrapped (kept) */}
                  <Suspense fallback={<div className="text-sm opacity-60">Loading…</div>}>
                    {children}
                  </Suspense>
                </div>
              </main>
            </div>
          </SelectedProductProvider>
        </Suspense>
      </body>
    </html>
  );
}