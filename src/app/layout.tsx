// app/layout.tsx
import "./globals.css";
import { Suspense } from "react";
import Link from "next/link";
import { SelectedProductProvider } from "./providers/SelectedProductProvider";
import ClientToaster from "@/components/ClientToaster";
import { Analytics } from "@vercel/analytics/react"; // <-- Import added here

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
            {/* The main tag no longer enforces padding */}
            <main className="flex-1">
              <Suspense
                fallback={
                  <div className="text-sm opacity-60">Loading…</div>
                }
              >
                {children}
              </Suspense>
            </main>
            <ClientToaster />
          </SelectedProductProvider>
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}