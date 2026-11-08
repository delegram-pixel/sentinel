"use client";

import { Map } from "lucide-react";
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { ResearchRoutePreview } from "@/components/onboarding/research-route-preview";
import { Button } from "@/components/ui/button";

const WorkspaceMapDialog = dynamic(() =>
  import("./workspace-map-dialog").then((module) => module.WorkspaceMapDialog),
);

const WorkspaceMapContext = createContext<{
  openMap: (trigger: HTMLElement) => void;
} | null>(null);

export function WorkspaceMapProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const returnFocus = useRef<HTMLElement | null>(null);
  const navigating = useRef(false);
  const openMap = useCallback((trigger: HTMLElement) => {
    returnFocus.current = trigger;
    navigating.current = false;
    setOpen(true);
  }, []);
  const context = useMemo(() => ({ openMap }), [openMap]);

  return (
    <WorkspaceMapContext.Provider value={context}>
      {children}
      {open ? (
        <WorkspaceMapDialog
          onClose={() => setOpen(false)}
          onNavigate={() => {
            navigating.current = true;
            setOpen(false);
          }}
          onRestoreFocus={() => {
            const trigger = returnFocus.current;
            if (!navigating.current && trigger?.isConnected && trigger.getClientRects().length) {
              trigger.focus();
            } else {
              const mobileTrigger = document.getElementById("mobile-navigation-trigger");
              const fallback =
                !navigating.current && mobileTrigger?.getClientRects().length
                  ? mobileTrigger
                  : document.getElementById("main-content");
              fallback?.focus();
            }
          }}
        />
      ) : null}
    </WorkspaceMapContext.Provider>
  );
}

export function useWorkspaceMap() {
  const context = useContext(WorkspaceMapContext);
  if (!context) throw new Error("Workspace map controls require WorkspaceMapProvider.");
  return context;
}

export function WorkspaceMapEntry() {
  const { openMap } = useWorkspaceMap();
  return (
    <section
      aria-label="Find your way around"
      className="flex flex-col gap-4 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-sm font-medium">A lot of pages. One research journey.</p>
        <ResearchRoutePreview />
        <p className="text-xs text-text-secondary">
          See how the pieces fit, then jump in. No breadcrumbs in your pockets required.
        </p>
      </div>
      <Button
        variant="outline"
        className="self-start sm:self-center"
        onClick={(event) => openMap(event.currentTarget)}
      >
        <Map data-icon="inline-start" aria-hidden />
        Open workspace map
      </Button>
    </section>
  );
}
