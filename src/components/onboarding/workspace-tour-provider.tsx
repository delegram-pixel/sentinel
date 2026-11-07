"use client";

import { Compass } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { dismissWorkspaceTourAction } from "@/app/(dashboard)/dashboard/tour-actions";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";

const WorkspaceTourDialog = dynamic(() =>
  import("./workspace-tour-dialog").then((module) => module.WorkspaceTourDialog),
);

const WorkspaceTourContext = createContext<{
  startTour: () => void;
  startAutomaticTour: () => void;
} | null>(null);

export function WorkspaceTourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const hasAutoStarted = useRef(false);
  const returnFocus = useRef<HTMLElement | null>(null);

  const startTour = useCallback(() => {
    hasAutoStarted.current = true;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setOpen(true);
  }, []);

  const startAutomaticTour = useCallback(() => {
    if (hasAutoStarted.current) return;
    hasAutoStarted.current = true;
    startTour();
  }, [startTour]);

  const context = useMemo(
    () => ({ startTour, startAutomaticTour }),
    [startTour, startAutomaticTour],
  );

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      <WorkspaceTourContext.Provider value={context}>
        {children}
        {open ? (
          <WorkspaceTourDialog
            onDismiss={async () => {
              const result = await dismissWorkspaceTourAction();
              if (result.ok) setOpen(false);
              return result;
            }}
            onCloseForNow={() => setOpen(false)}
            onCreateProject={() => router.push("/dashboard/projects/new")}
            onRestoreFocus={() => {
              const target = returnFocus.current;
              if (target?.isConnected && target !== document.body) target.focus();
              else document.getElementById("main-content")?.focus();
            }}
          />
        ) : null}
      </WorkspaceTourContext.Provider>
    </TooltipProvider>
  );
}

function useWorkspaceTour() {
  const context = useContext(WorkspaceTourContext);
  if (!context) throw new Error("Workspace tour controls require WorkspaceTourProvider.");
  return context;
}

// The authenticated server loader mounts this only for eligible new users.
// The provider stays mounted between dashboard routes, so a streamed refresh
// cannot restart a tour that was already offered during this visit.
export function AutomaticWorkspaceTour() {
  const { startAutomaticTour } = useWorkspaceTour();
  useEffect(startAutomaticTour, [startAutomaticTour]);
  return null;
}

export function ReplayWorkspaceTourButton() {
  const { startTour } = useWorkspaceTour();
  return (
    <Button type="button" variant="outline" onClick={startTour}>
      <Compass data-icon="inline-start" aria-hidden />
      Replay workspace tour
    </Button>
  );
}
