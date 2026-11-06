import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

export function Empty({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="empty" className={cn("empty-state", className)} {...props} />;
}

export function EmptyHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-header"
      className={cn("flex max-w-xl flex-col gap-2", className)}
      {...props}
    />
  );
}

export function EmptyTitle({
  className,
  level = 3,
  ...props
}: ComponentProps<"h3"> & { level?: 2 | 3 }) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Heading data-slot="empty-title" className={cn("text-sm font-medium", className)} {...props} />
  );
}

export function EmptyDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      data-slot="empty-description"
      className={cn("text-sm leading-relaxed text-text-secondary", className)}
      {...props}
    />
  );
}

export function EmptyContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="empty-content"
      className={cn("mt-3 flex flex-wrap items-center gap-3", className)}
      {...props}
    />
  );
}
