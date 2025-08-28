"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/insights",  label: "Insights",  Icon: LineChart },
  { href: "/settings",  label: "Settings",  Icon: Settings },
];

export default function SidebarItems() {
  const pathname = usePathname();

  return (
    <nav className="px-2 space-y-1">
      {items.map(({ href, label, Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:card",
              // visible highlight: page card lavender + teal left bar + subtle ring
              isActive &&
                "bg-[hsl(var(--card))] ring-1 ring-[hsl(var(--border))]"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}