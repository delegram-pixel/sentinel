"use client";

import { CircleHelp } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type HelpContent = {
  description: string;
  example?: string;
  note?: string;
};

export function HelpTooltip({
  label,
  description,
  example,
  note,
  side = "top",
  sideOffset = 8,
}: HelpContent & {
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
}) {
  const [mode, setMode] = useState<"closed" | "hover" | "pinned">("closed");
  return (
    <Tooltip
      open={mode !== "closed"}
      onOpenChange={(open) => {
        // A tap/click stays open while the user reads. Touch pointer-leave and
        // synthesized focus events must not immediately dismiss pinned help.
        setMode((current) => (current === "pinned" ? current : open ? "hover" : "closed"));
      }}
    >
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="size-6 rounded-full text-text-secondary/80 hover:text-primary [&_svg:not([class*='size-'])]:size-3.5"
          aria-label={`Help for ${label}`}
          onClick={(event) => {
            // Keep the tooltip open on click/touch as well as hover or focus.
            // Prevent Radix's default click-to-close handler from overriding it.
            event.preventDefault();
            setMode((current) => (current === "pinned" ? "closed" : "pinned"));
          }}
          onBlur={() => setMode("closed")}
        >
          <CircleHelp aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={sideOffset}
        align={side === "right" ? "start" : "center"}
        onEscapeKeyDown={() => setMode("closed")}
        onPointerDownOutside={() => setMode("closed")}
      >
        <p className="mb-2 text-[13px] font-semibold text-background">{label}</p>
        <p className="text-background/85">{description}</p>
        {example ? (
          <div className="mt-3 border-l-2 border-background/30 pl-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-background/70">
              Example
            </p>
            <p className="text-background/90">{example}</p>
          </div>
        ) : null}
        {note ? (
          <p className="mt-3 border-t border-background/15 pt-3 text-background/75">{note}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
