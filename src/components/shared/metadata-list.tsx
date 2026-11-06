import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type MetadataItem = {
  label: string;
  value: ReactNode;
  technical?: boolean;
};

export function MetadataList({
  items,
  className,
  label,
}: {
  items: readonly MetadataItem[];
  className?: string;
  label?: string;
}) {
  return (
    <dl className={cn("metadata-list", className)} aria-label={label}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt>{item.label}</dt>
          <dd className={cn(item.technical && "record-metadata")}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
