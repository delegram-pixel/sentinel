"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { isNavItemActive, NAV_GROUPS } from "@/components/layout/nav";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { HelpTooltip } from "@/components/shared/help-tooltip";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense
      fallback={
        <aside className="h-full w-56 border-r border-border bg-surface p-6">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-12 h-64 w-full" />
        </aside>
      }
    >
      <SidebarContent onNavigate={onNavigate} />
    </Suspense>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border bg-surface">
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex h-14 shrink-0 flex-col justify-center border-b border-border px-6"
        aria-label="Sentinel Research home"
      >
        <span className="font-display text-[24px] leading-none tracking-tight">Sentinel</span>
        <span className="mt-1 text-xs leading-4 text-text-secondary">Research</span>
      </Link>
      <nav
        className="flex flex-1 flex-col gap-7 overflow-y-auto px-5 py-8"
        aria-label="Primary navigation"
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-2 pl-3 text-xs text-text-secondary">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isNavItemActive(pathname, item);
                return (
                  <li key={item.href} className="flex items-center gap-0.5">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 min-w-0 flex-1 items-center border-l-2 border-transparent px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-secondary hover:text-foreground",
                        active && "border-primary font-medium text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
                    {item.help ? (
                      <HelpTooltip
                        label={item.label}
                        {...item.help}
                        side={onNavigate ? "bottom" : "right"}
                        sideOffset={onNavigate ? 8 : 24}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
