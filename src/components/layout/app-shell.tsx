"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

type AppShellProps = {
  children: ReactNode;
  workspaceName?: ReactNode;
  accountMenu?: ReactNode;
};

export function AppShell({ children, workspaceName, accountMenu }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (desktop.matches) setMobileOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="min-h-dvh bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-sm focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:block">
          <Sidebar />
        </div>
        <SheetContent
          side="left"
          closeLabel="Close navigation"
          className="w-56 border-r-0 bg-surface"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Workspace, research, and account navigation.
          </SheetDescription>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
        <div className="lg:pl-56">
          <Header workspaceName={workspaceName} accountMenu={accountMenu} />
          <main
            id="main-content"
            tabIndex={-1}
            className="mx-auto w-full max-w-[90rem] px-5 py-8 sm:px-8 sm:py-10 lg:px-10"
          >
            {children}
          </main>
        </div>
      </div>
    </Sheet>
  );
}
