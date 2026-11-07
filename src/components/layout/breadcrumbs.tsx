"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Ellipsis } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  investigations: "Investigations",
  targets: "Targets",
  scopes: "Scopes",
  findings: "Findings",
  evidence: "Evidence",
  reports: "Reports",
  settings: "Settings",
  engagements: "Engagements",
  knowledge: "Knowledge",
  imports: "Tool imports",
  remediation: "Remediation & outcomes",
  tasks: "Background work",
  insights: "Research insights",
  ai: "AI assistance",
  upload: "Upload",
  new: "New",
  edit: "Edit",
};

const RECORD_LABELS: Record<string, string> = {
  projects: "Project",
  investigations: "Investigation",
  targets: "Target",
  scopes: "Scope version",
  findings: "Finding",
  evidence: "Evidence record",
  reports: "Report",
  engagements: "Engagement",
  knowledge: "Knowledge document",
  imports: "Tool import",
};

function labelForSegment(segment: string, previous?: string): string {
  const known = SEGMENT_LABELS[segment];
  if (known) return known;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segment)) {
    return RECORD_LABELS[previous ?? ""] ?? "Record";
  }
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: labelForSegment(segment, segments[index - 1]),
    href:
      segment === "scopes"
        ? "/" + segments.slice(0, index).join("/") + "#target-scopes"
        : "/" + segments.slice(0, index + 1).join("/"),
  }));
  const collapsed = crumbs.length > 3;

  return (
    <nav aria-label="Breadcrumb" className="min-w-0 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-1.5 text-xs">
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          if (collapsed && index > 0 && index < crumbs.length - 2) {
            if (index !== 1) return null;

            return (
              <li key="full-path" className="flex shrink-0 items-center gap-1.5">
                <ChevronRight className="hidden size-3 text-text-secondary sm:block" aria-hidden />
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label="Show full path">
                      <Ellipsis data-icon="inline-start" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent closeLabel="Close full path">
                    <SheetHeader>
                      <SheetTitle>Research location</SheetTitle>
                      <SheetDescription>
                        Navigate to a parent section or research record.
                      </SheetDescription>
                    </SheetHeader>
                    <nav aria-label="Full breadcrumb" className="px-6 py-4">
                      <ol className="flex flex-col">
                        {crumbs.map((location, locationIndex) => (
                          <li key={location.href} className="border-b border-border py-3">
                            {locationIndex === crumbs.length - 1 ? (
                              <span aria-current="page" className="block py-1 text-sm">
                                {location.label}
                              </span>
                            ) : (
                              <SheetClose asChild>
                                <Link
                                  href={location.href}
                                  className="record-link block py-1 text-sm"
                                >
                                  {location.label}
                                </Link>
                              </SheetClose>
                            )}
                          </li>
                        ))}
                      </ol>
                    </nav>
                  </SheetContent>
                </Sheet>
              </li>
            );
          }
          return (
            <li
              key={crumb.href}
              className={cn(
                "flex min-w-0 items-center gap-1.5",
                index === 0 && crumbs.length > 2 && "hidden sm:flex",
              )}
            >
              {index > 0 ? (
                <ChevronRight
                  className={cn(
                    "size-3 shrink-0 text-text-secondary",
                    !collapsed && index === 1 && crumbs.length > 2 && "hidden sm:block",
                  )}
                  aria-hidden
                />
              ) : null}
              {last ? (
                <span className="truncate text-foreground" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="flex min-h-9 min-w-0 items-center text-text-secondary transition-colors hover:text-primary"
                >
                  <span className="truncate">{crumb.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
