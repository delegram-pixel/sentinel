import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { Button } from "@/components/ui/button";

type ModulePlaceholderProps = { title: string; description: string; nextStep: string };

export function ModulePlaceholder({ title, description, nextStep }: ModulePlaceholderProps) {
  return (
    <div className="page-stack">
      <PageHeader title={title} description={description} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <ResearchSection id="module-records" title={`${title} archive`}>
          <EmptyState
            title={`${title} are not available yet`}
            description={nextStep}
            action={
              <Button asChild variant="outline">
                <Link href="/dashboard/investigations">Open investigations</Link>
              </Button>
            }
          />
        </ResearchSection>
        <ResearchSection id="research-continuity" title="Keep the research connected">
          <p className="text-sm leading-relaxed text-text-secondary">
            Continue recording observations, testing hypotheses, and saving session summaries in
            your investigations.
          </p>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            Research conclusions depend on source records and human review.
          </p>
        </ResearchSection>
      </div>
    </div>
  );
}
