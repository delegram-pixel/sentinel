import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Disclosure({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cn("disclosure", className)}>
      <summary>
        {title}
        <ChevronDown className="size-4 text-text-secondary" aria-hidden />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
