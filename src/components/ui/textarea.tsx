import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"textarea"> & { variant?: "default" | "technical" }) {
  return (
    <textarea
      data-slot="textarea"
      autoComplete="off"
      spellCheck={variant === "technical" ? false : undefined}
      className={cn(
        "flex min-h-28 w-full min-w-0 rounded-sm border border-input bg-surface-elevated px-3 py-2 text-base leading-relaxed transition-colors placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-invalid:border-destructive",
        variant === "technical" && "font-mono md:text-xs",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
