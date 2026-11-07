"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  children,
  sideOffset = 8,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={16}
        className={cn(
          "z-[70] w-80 max-w-[calc(100vw-2rem)] rounded-md border border-background/15 bg-foreground text-xs leading-relaxed text-background shadow-lg",
          className,
        )}
        {...props}
      >
        <div className="max-h-[min(24rem,calc(var(--radix-tooltip-content-available-height)-2px))] overflow-y-auto px-4 py-3.5">
          {children}
        </div>
        <TooltipPrimitive.Arrow width={10} height={5} className="fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
