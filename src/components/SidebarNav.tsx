"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Settings } from "lucide-react";
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/Sidebar";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/insights",  label: "Insights",  icon: LineChart },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <SidebarContent>
      <SidebarMenu>
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");

          return (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                /* Active = columbia tint + teal left bar; hover tints consistently */
                className="
                  rounded-xl 
                  data-[active=true]:bg-[hsl(var(--card)/0.45)]
                  data-[active=true]:text-[hsl(var(--foreground))]
                  data-[active=true]:shadow-[inset_4px_0_0_0_hsl(var(--primary))]
                  hover:bg-[hsl(var(--accent)/0.35)]
                  hover:text-[hsl(var(--foreground))]
                "
              >
                <Link href={href}>
                  <Icon />
                  <span className="font-medium">{label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarContent>
  );
}