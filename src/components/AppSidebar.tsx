// ./src/components/AppSidebar.tsx
"use client";

import * as React from "react";
import type { ReactElement } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { useSidebar } from "@/components/Sidebar";

function getCurrentPage(pathname: string): "dashboard" | "insights" | "settings" {
  if (pathname.startsWith("/insights")) return "insights";
  if (pathname.startsWith("/settings")) return "settings";
  return "dashboard";
}

export default function AppSidebar(): ReactElement {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, openMobile, setOpenMobile, open } = useSidebar();

  const currentPage = React.useMemo(() => getCurrentPage(pathname), [pathname]);
  const isOpen = isMobile ? openMobile : open;

  const onClose = React.useCallback(() => setOpenMobile(false), [setOpenMobile]);
  const onNavigate = React.useCallback(
    (page: string) => {
      const href = page === "dashboard" ? "/dashboard" : page === "insights" ? "/insights" : "/settings";
      router.push(href);
      if (isMobile) setOpenMobile(false);
    },
    [router, isMobile, setOpenMobile]
  );

  return (
    <DashboardSidebar
      isOpen={isOpen}
      onClose={onClose}
      currentPage={currentPage}
      onNavigate={onNavigate}
    />
  );
}