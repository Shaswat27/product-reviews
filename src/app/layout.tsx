// app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import Link from "next/link";
import { SelectedProductProvider } from "./providers/SelectedProductProvider";
import ClientToaster from "@/components/ClientToaster";

export const metadata = {
  title: "SignalLens",
  description: "Product review and customer feedback analysis tool",
  other: {
    "trustpilot-one-time-domain-verification-id":
      "4784bee8-c43b-44a3-bf3c-73cf39b417d0",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <Suspense
          fallback={<div className="p-4 text-sm opacity-60">Loading…</div>}
        >
          <SelectedProductProvider>
            {/* The <header> is removed from the layout. The page will now control its own header. */}
            <main className="flex-1">
              <div className="w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
                <Suspense
                  fallback={
                    <div className="text-sm opacity-60">Loading…</div>
                  }
                >
                  {children}
                </Suspense>
              </div>
            </main>

            {/* Global toast portal */}
            <ClientToaster />
          </SelectedProductProvider>
        </Suspense>
      </body>
    </html>
  );
}