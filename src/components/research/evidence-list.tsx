import Link from "next/link";

import { EvidenceTypeLabel, RedactionStatusBadge } from "@/components/research/phase6-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { EvidenceReference } from "@/components/shared/evidence-reference";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchTime } from "@/components/shared/research-time";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format";
import type { EvidenceRow } from "@/modules/evidence/application/ports";

export function EvidenceList({ evidence }: { evidence: EvidenceRow[] }) {
  if (!evidence.length)
    return (
      <EmptyState
        headingLevel={2}
        title="No evidence recorded"
        description="Add a screenshot, request or response, log, or document from an investigation. Files remain quarantined until a human reviewer resolves redaction."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard/investigations">Open investigations</Link>
          </Button>
        }
      />
    );
  return (
    <RecordTable caption="Evidence records" minWidth="58rem">
      <thead>
        <tr>
          <th scope="col">Evidence record</th>
          <th scope="col">Investigation</th>
          <th scope="col">Type</th>
          <th scope="col">Redaction</th>
          <th scope="col">File</th>
          <th scope="col">Recorded</th>
        </tr>
      </thead>
      <tbody>
        {evidence.map((item) => (
          <tr key={item.id}>
            <td className="max-w-72">
              <Link href={`/dashboard/evidence/${item.id}`} className="record-link break-words">
                {item.title}
              </Link>
              <div className="mt-2">
                <EvidenceReference id={item.id} />
              </div>
            </td>
            <td className="max-w-48">
              <Link
                href={`/dashboard/investigations/${item.investigationId}`}
                className="text-sm hover:text-primary hover:underline"
              >
                {item.investigationTitle}
              </Link>
            </td>
            <td>
              <EvidenceTypeLabel type={item.evidenceType} />
            </td>
            <td>
              <RedactionStatusBadge status={item.redactionStatus} />
            </td>
            <td className="max-w-64">
              <p className="record-metadata">{item.fileName}</p>
              <p className="record-metadata mt-1">
                {formatFileSize(item.fileSize)}; version {item.version}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                {item.findingLinkCount} findings linked
              </p>
            </td>
            <td>
              <ResearchTime date={item.createdAt} precision="time" />
            </td>
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
