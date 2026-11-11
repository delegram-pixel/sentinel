import type { ReactNode } from "react";

import { FieldDescription } from "@/components/ui/field";

/**
 * Visible guidance shown directly beneath a form control. The tooltip help remains
 * available for deeper detail, but beginners should not need to discover it to
 * understand what a field expects.
 */
export function FieldHint({
  id,
  children,
  example,
  note,
}: {
  id: string;
  children: ReactNode;
  example?: string;
  note?: string;
}) {
  return (
    <div id={id} className="flex flex-col gap-1">
      <FieldDescription>{children}</FieldDescription>
      {example ? (
        <p className="text-xs leading-relaxed text-text-secondary">
          <span className="font-medium text-foreground">Example:</span> {example}
        </p>
      ) : null}
      {note ? <p className="text-xs leading-relaxed text-text-secondary">{note}</p> : null}
    </div>
  );
}
