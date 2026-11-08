"use client";

import { ArrowUpRight, Map, MapPin, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "radix-ui";
import { useRef } from "react";

import {
  getWorkspaceMapItem,
  isWorkspaceMapDestinationActive,
  WORKSPACE_MAP_STAGES,
  WORKSPACE_MAP_UTILITIES,
} from "@/components/onboarding/workspace-map-data";
import { Button } from "@/components/ui/button";

function YouAreHere() {
  return (
    <span className="workspace-map-location flex items-center gap-1.5 text-xs font-medium text-primary">
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      You are here
    </span>
  );
}

export function WorkspaceMapDialog({
  onClose,
  onNavigate,
  onRestoreFocus,
}: {
  onClose: () => void;
  onNavigate: () => void;
  onRestoreFocus: () => void;
}) {
  const pathname = usePathname();
  const title = useRef<HTMLHeadingElement>(null);
  const scrollRegion = useRef<HTMLDivElement>(null);
  const active = (href: string) => isWorkspaceMapDestinationActive(pathname, href);

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/35" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-xl outline-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            title.current?.focus();
            const region = scrollRegion.current;
            const current = region?.querySelector<HTMLElement>('[aria-current="page"]');
            if (region && current) {
              const bounds = region.getBoundingClientRect();
              const location = current.getBoundingClientRect();
              if (location.top < bounds.top || location.bottom > bounds.bottom) {
                // Bring the current stop and its stage heading into the scroll area.
                region.scrollTop += location.top - bounds.top - 80;
              }
            }
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-8 sm:py-6">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="flex items-center gap-2 text-xs font-medium text-primary">
                <Map className="size-4" aria-hidden />
                Your workspace, at a glance
              </p>
              <Dialog.Title
                ref={title}
                tabIndex={-1}
                className="font-display text-3xl font-normal outline-none sm:text-4xl"
              >
                Workspace map
              </Dialog.Title>
              <Dialog.Description className="max-w-2xl text-sm leading-relaxed text-text-secondary">
                Follow a question from first idea to final outcome. Choose any stop to open it; take
                the side paths whenever you need them.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close workspace map">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </div>
          <div
            ref={scrollRegion}
            className="min-h-0 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6"
          >
            <nav aria-label="Workspace map destinations" className="flex flex-col gap-6">
              <div className="workspace-map-board">
                <ol className="workspace-map-flow" aria-label="Main research path">
                  {WORKSPACE_MAP_STAGES.map((stage, index) => (
                    <li
                      key={stage.id}
                      className="workspace-map-stage"
                      data-active={
                        active(stage.href) || stage.branches.some((branch) => active(branch.href))
                      }
                    >
                      <h3 className="workspace-map-stage-heading">
                        <span className="workspace-map-stage-marker" aria-hidden>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        {stage.name}
                      </h3>
                      <Link
                        href={stage.href}
                        prefetch={false}
                        onNavigate={onNavigate}
                        aria-current={active(stage.href) ? "page" : undefined}
                        className="workspace-map-stop"
                      >
                        <span className="workspace-map-stop-title">
                          {getWorkspaceMapItem(stage.href)?.label}
                          <ArrowUpRight aria-hidden />
                        </span>
                        <span className="workspace-map-hint">{stage.hint}</span>
                        {active(stage.href) ? <YouAreHere /> : null}
                      </Link>
                      {stage.branches.length ? (
                        <ul
                          className="workspace-map-branches"
                          aria-label={`${stage.name} supporting tools`}
                        >
                          {stage.branches.map((branch) => (
                            <li key={branch.href}>
                              <Link
                                href={branch.href}
                                prefetch={false}
                                onNavigate={onNavigate}
                                aria-current={active(branch.href) ? "page" : undefined}
                                className="workspace-map-branch"
                              >
                                <span className="text-[13px] font-medium">
                                  {getWorkspaceMapItem(branch.href)?.label}
                                </span>
                                <span className="workspace-map-hint">{branch.hint}</span>
                                {active(branch.href) ? <YouAreHere /> : null}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {stage.note ? <p className="workspace-map-stage-note">{stage.note}</p> : null}
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-medium">Always within reach</h3>
                  <p className="text-xs text-text-secondary">
                    Useful wherever you are on the path.
                  </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {WORKSPACE_MAP_UTILITIES.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        prefetch={false}
                        onNavigate={onNavigate}
                        aria-current={active(item.href) ? "page" : undefined}
                        className="workspace-map-utility"
                      >
                        <span className="flex items-center gap-2 text-[13px] font-medium">
                          {getWorkspaceMapItem(item.href)?.label}
                          <ArrowUpRight className="size-3.5 text-primary" aria-hidden />
                        </span>
                        <span className="workspace-map-hint">{item.hint}</span>
                        {active(item.href) ? <YouAreHere /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>
          <p className="border-t border-border px-5 py-4 text-xs leading-relaxed text-text-secondary sm:px-8">
            A suggested route, not a checklist. Research takes detours. The map won’t judge.
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
