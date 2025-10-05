"use client";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Search, RefreshCw, Menu } from "lucide-react";
import * as React from "react";

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
  /** Optional: replace desktop right controls */
  rightSlotDesktop?: React.ReactNode;
  /** Optional: replace mobile right controls */
  rightSlotMobile?: React.ReactNode;
}

export function AppHeader({
  title,
  subtitle,
  onMenuClick,
  rightSlotDesktop,
  rightSlotMobile,
}: AppHeaderProps) {
  return (
    <header
      className={
        // Flat, white, no blur, no shadow, minimal padding
        "bg-background text-foreground px-3 lg:px-4 py-3"
      }
    >
      <div className="space-y-2 lg:space-y-0">
        {/* Top row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile hamburger menu */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onMenuClick}
              className="lg:hidden h-8 w-8"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Title + subtitle */}
            <div className="hidden lg:block leading-tight">
              <div className="text-[1.1rem] font-semibold">{title}</div>
              {subtitle ? (
                <div className="text-xs text-muted-foreground -mt-0.5">{subtitle}</div>
              ) : null}
            </div>
          </div>

          {/* Desktop right controls — tighter spacing, aligned to very top-right */}
          <div className="hidden lg:flex items-center gap-2">
            {rightSlotDesktop ?? (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="monday.com"
                    className="h-8 pl-9 w-60 bg-background border-border"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 gap-2 border-border"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile title + subtitle */}
        <div className="lg:hidden leading-tight">
          <div className="text-base font-semibold">{title}</div>
          {subtitle ? (
            <div className="text-xs text-muted-foreground -mt-0.5">{subtitle}</div>
          ) : null}
        </div>

        {/* Mobile right controls — compact height */}
        <div className="flex lg:hidden items-center gap-2">
          {rightSlotMobile ?? (
            <>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="monday.com"
                  className="h-9 pl-9 bg-background border-border"
                />
              </div>
              <Button variant="outline" size="sm" className="h-9 px-3 gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="text-xs">Refresh</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}