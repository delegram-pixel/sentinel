"use client";

import { Menu } from "lucide-react";
import { Suspense, type ReactNode } from "react";

import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { Button } from "@/components/ui/button";
import { SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";

export function Header({
  workspaceName,
  accountMenu,
}: {
  workspaceName?: ReactNode;
  accountMenu?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6 lg:px-8">
      <SheetTrigger asChild>
        <Button
          id="mobile-navigation-trigger"
          variant="ghost"
          size="icon"
          className="-ml-2 shrink-0 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu data-icon="inline-start" aria-hidden />
        </Button>
      </SheetTrigger>
      <Suspense fallback={<Skeleton className="h-4 w-28" />}>
        <Breadcrumbs />
      </Suspense>
      <div className="ml-auto flex shrink-0 items-center gap-5">
        <div className="hidden max-w-64 truncate text-xs text-text-secondary md:block">
          {workspaceName ?? "Workspace"}
        </div>
        {accountMenu}
      </div>
    </header>
  );
}
