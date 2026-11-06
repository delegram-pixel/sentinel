"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavItemActive, NAV_GROUPS } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
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
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-10 items-center border-l-2 border-transparent px-3 py-2 text-[13px] text-text-secondary transition-colors hover:bg-secondary hover:text-foreground",
                        active && "border-primary font-medium text-foreground",
                      )}
                    >
                      {item.label}
                    </Link>
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
