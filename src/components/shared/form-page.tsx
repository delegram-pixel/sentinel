import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

export function FormPage({
  title,
  description,
  backHref,
  backLabel,
  children,
}: {
  title: string;
  description: ReactNode;
  backHref: string;
  backLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="page-stack max-w-3xl">
      <Link href={backHref} className="record-link w-fit text-sm text-text-secondary">
        {backLabel}
      </Link>
      <PageHeader title={title} description={description} />
      {children}
    </div>
  );
}

export function FormSkeleton({
  label = "Loading form",
  fields = 4,
}: {
  label?: string;
  fields?: number;
}) {
  return (
    <div role="status" aria-label={label}>
      <span className="sr-only">{label}…</span>
      <div className="form-stack" aria-hidden>
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <Skeleton className="h-3 w-28" />
            <Skeleton className={index === fields - 1 ? "h-28 w-full" : "h-10 w-full"} />
          </div>
        ))}
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  );
}
