import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { HelpTooltip, type HelpContent } from "@/components/shared/help-tooltip";

type ResearchSectionProps = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  help?: HelpContent;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function ResearchSection({
  id,
  title,
  description,
  help,
  action,
  children,
  className,
}: ResearchSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("research-section", className)}>
      <div className="section-heading">
        <div className="flex items-center gap-2">
          <h2 id={`${id}-title`} className="section-title">
            {title}
          </h2>
          {help ? (
            <HelpTooltip label={typeof title === "string" ? title : "This section"} {...help} />
          ) : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
      {description ? (
        <p className="mb-3 max-w-2xl text-sm leading-relaxed text-text-secondary">{description}</p>
      ) : null}
      <div className="section-body">{children}</div>
    </section>
  );
}
