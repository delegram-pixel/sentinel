import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

export type StatusTone = "neutral" | "secondary" | "success" | "warning" | "danger";

export function StatusLabel({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return <Badge variant={tone}>{children}</Badge>;
}

export function SourceLabel({
  source,
}: {
  source: "researcher" | "evidence" | "ai" | "human-review";
}) {
  const labels = {
    researcher: "Researcher recorded",
    evidence: "Original evidence",
    ai: "AI interpretation",
    "human-review": "Human review",
  } as const;

  return <Badge variant={source === "ai" ? "default" : "secondary"}>{labels[source]}</Badge>;
}
