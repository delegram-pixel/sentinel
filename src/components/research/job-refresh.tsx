"use client";
import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
export function JobRefresh({ active }: { active: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => startTransition(() => router.refresh()), 10000);
    return () => clearInterval(timer);
  }, [active, router]);
  return active ? (
    <p role="status" className="text-sm text-muted-foreground">
      {pending
        ? "Updating work status…"
        : "Status refreshes every 10 seconds while work is queued or running."}
    </p>
  ) : null;
}
