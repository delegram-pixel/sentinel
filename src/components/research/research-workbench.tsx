"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const wideQuery = "(min-width: 1440px)";
function subscribe(callback: () => void) {
  const media = window.matchMedia(wideQuery);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function getSnapshot() {
  return window.matchMedia(wideQuery).matches;
}
function getServerSnapshot() {
  return false;
}

export function ResearchWorkbench({
  context,
  children,
  assistant,
}: {
  context: ReactNode;
  children: ReactNode;
  assistant: ReactNode;
}) {
  const wide = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex justify-end">
        {wide ? (
          <Button
            variant="outline"
            size="sm"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close assistance" : "Research assistance"}
          </Button>
        ) : (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                Research assistance
              </Button>
            </SheetTrigger>
            <SheetContent closeLabel="Close assistance">
              <SheetHeader>
                <SheetTitle>Research assistance</SheetTitle>
                <SheetDescription>
                  Review the saved context and find your next step for this investigation.
                </SheetDescription>
              </SheetHeader>
              <div className="px-6 py-6">{assistant}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      <div className="research-workbench" data-assistant-open={wide && open}>
        <aside className="research-context" aria-label="Investigation context">
          {context}
        </aside>
        <div className="research-document page-stack">{children}</div>
        {wide && open ? (
          <aside id={panelId} className="research-assistant" aria-label="Research assistance">
            {assistant}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
