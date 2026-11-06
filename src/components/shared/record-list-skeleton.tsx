import { Skeleton } from "@/components/ui/skeleton";

export function RecordListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true">
      <span className="sr-only">{label}…</span>
      <div className="flex flex-col gap-5" aria-hidden>
        <div className="flex justify-between gap-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-6 border-t border-border pt-5"
          >
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-5 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
