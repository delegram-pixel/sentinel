import { ArrowRight } from "lucide-react";

import { WORKSPACE_MAP_STAGES } from "@/components/onboarding/workspace-map-data";

export function ResearchRoutePreview() {
  return (
    <ol className="research-route-preview" aria-label="Research route">
      {WORKSPACE_MAP_STAGES.map((stage, index) => (
        <li key={stage.id}>
          <span>{stage.name}</span>
          {index < WORKSPACE_MAP_STAGES.length - 1 ? <ArrowRight aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}
