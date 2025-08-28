import "./globals.css";
import SidebarItems from "./SidebarItems"; // ⬅️ client component with icons + active state
import { SelectedProductProvider } from "./providers/SelectedProductProvider";

export const metadata = {
  title: "SignalLens",
  description: "Product review and customer feedback analysis tool",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        <SelectedProductProvider>
          <div className="flex min-h-screen">
            {/* Sidebar (fixed width, card background) */}
            <aside className="w-64 shrink-0 border-r bg-card">
              <div className="px-4 py-4">
                <div className="text-xl font-bold heading-accent tracking-tight">
                  SignalLens
                </div>
                <div className="brand-underline mt-1" />
                <div className="text-xs body-ink -mt-0.1">Product Insights</div>
              </div>

              {/* Client-rendered sidebar links (handles highlight + icons) */}
              <SidebarItems />
            </aside>

            {/* Main (centered container, no extra columns anywhere) */}
            <main className="flex-1 bg-background text-foreground">
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </main>
          </div>
        </SelectedProductProvider>
      </body>
    </html>
  );
}