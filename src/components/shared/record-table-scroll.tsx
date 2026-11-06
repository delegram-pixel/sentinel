"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function RecordTableScroll({ label, children }: { label: string; children: ReactNode }) {
  const regionRef = useRef<HTMLDivElement>(null);
  const hintId = useId();
  const [available, setAvailable] = useState({ left: false, right: false });
  const overflow = available.left || available.right;

  const measure = useCallback(() => {
    const region = regionRef.current;
    if (!region) return;

    const left = region.scrollLeft > 1;
    const right = region.scrollWidth - region.clientWidth - region.scrollLeft > 1;
    setAvailable((previous) =>
      previous.left === left && previous.right === right ? previous : { left, right },
    );
  }, []);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;

    const observer = new ResizeObserver(measure);
    observer.observe(region);
    if (region.firstElementChild) observer.observe(region.firstElementChild);
    return () => observer.disconnect();
  }, [measure]);

  function scroll(direction: -1 | 1) {
    const region = regionRef.current;
    if (!region) return;

    region.scrollBy({
      left: direction * Math.max(160, region.clientWidth * 0.75),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }

  return (
    <div className="min-w-0">
      <div
        ref={regionRef}
        className="record-table-region"
        role="region"
        aria-label={label}
        aria-describedby={overflow ? hintId : undefined}
        tabIndex={overflow ? 0 : undefined}
        data-overflow={overflow}
        onScroll={measure}
      >
        {children}
      </div>
      {overflow ? (
        <div className="mt-2 flex items-center justify-between gap-3">
          <p id={hintId} className="text-xs text-text-secondary">
            Scroll to see all columns.
          </p>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Scroll columns left"
              disabled={!available.left}
              onClick={() => scroll(-1)}
            >
              <ChevronLeft data-icon="inline-start" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Scroll columns right"
              disabled={!available.right}
              onClick={() => scroll(1)}
            >
              <ChevronRight data-icon="inline-start" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
