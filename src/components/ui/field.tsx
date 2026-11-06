import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("form-stack", className)} {...props} />;
}

export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cn("form-stack", className)} {...props} />;
}

export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return (
    <legend
      data-slot="field-legend"
      className={cn("mb-3 text-sm font-medium", className)}
      {...props}
    />
  );
}

const fieldVariants = cva("group/field flex min-w-0 gap-2", {
  variants: {
    orientation: {
      vertical: "flex-col",
      horizontal: "flex-row items-start gap-3",
    },
  },
  defaultVariants: { orientation: "vertical" },
});

export function Field({
  className,
  orientation,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div data-slot="field" className={cn(fieldVariants({ orientation }), className)} {...props} />
  );
}

export const FieldLabel = Label;

export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn("text-xs leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
}

export function FieldError({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="field-error"
      role="alert"
      className={cn("text-xs leading-relaxed text-danger", className)}
      {...props}
    />
  );
}
