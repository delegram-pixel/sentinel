import Link from "next/link";

import { FindingStatusBadge, SeverityBadge } from "@/components/research/phase6-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import type { FindingRow } from "@/modules/findings/application/ports";

export function FindingList({ findings }: { findings: FindingRow[] }) {
  if (!findings.length)
    return (
      <EmptyState
        headingLevel={2}
        title="No findings recorded"
        description="Have a lead backed by observations and evidence? Create a finding from its investigation, then send it for human review when it's ready."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/investigations">Open investigations</Link>
          </Button>
        }
      />
    );
  return (
    <RecordTable caption="Finding records" minWidth="52rem">
      <thead>
        <tr>
          <th scope="col">Finding</th>
          <th scope="col">Affected asset</th>
          <th scope="col">Verification</th>
          <th scope="col">Severity</th>
          <th scope="col">Evidence</th>
          <th scope="col">Updated</th>
        </tr>
      </thead>
      <tbody>
        {findings.map((finding) => (
          <tr key={finding.id}>
            <td className="max-w-80">
              <Link href={`/dashboard/findings/${finding.id}`} className="record-link break-words">
                {finding.title}
              </Link>
              <p className="mt-1 text-xs text-text-secondary">{finding.investigationTitle}</p>
              <div className="mt-2">
                <EvidenceReference id={finding.id} label="Finding" />
              </div>
            </td>
            <td className="max-w-48">
              <span
                className={
                  finding.affectedAsset ? "record-metadata" : "text-xs text-text-secondary"
                }
              >
                {finding.affectedAsset ?? "Not recorded"}
              </span>
            </td>
            <td>
              <FindingStatusBadge status={finding.status} />
            </td>
            <td>
              <SeverityBadge severity={finding.severity} />
            </td>
            <td className="font-mono text-xs">{finding.evidenceLinkCount} linked</td>
            <td>
              <ResearchTime date={finding.updatedAt} />
            </td>
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
