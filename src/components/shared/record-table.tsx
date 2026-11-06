import type { ReactNode } from "react";

import { RecordTableScroll } from "@/components/shared/record-table-scroll";

export function RecordTable({
  caption,
  children,
  minWidth = "36rem",
}: {
  caption: string;
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <RecordTableScroll label={caption}>
      <table className="record-table" style={{ minWidth }}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </RecordTableScroll>
  );
}
