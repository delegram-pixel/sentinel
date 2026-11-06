import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

const alertVariants = cva("min-w-0 border-l-2 px-4 py-2 text-sm", {
  variants: {
    variant: {
      default: "border-control-border text-foreground",
      warning: "border-warning text-foreground",
      destructive: "border-danger text-foreground",
      success: "border-success text-foreground",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Alert({
  className,
  variant,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3 data-slot="alert-title" className={cn("mb-1 text-sm font-medium", className)} {...props} />
  );
}

export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
}
