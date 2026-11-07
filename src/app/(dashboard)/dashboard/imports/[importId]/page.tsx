import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { PrismaImportStore } from "@/modules/imports/infrastructure/prisma-import-store";
import { canonicalResultSchema } from "@/modules/imports/domain/tool-import";
import { reviewImportAction } from "../actions";
export const metadata = { title: "Review import" };
export default function ImportPage({ params }: { params: Promise<{ importId: string }> }) {
  return (
    <Suspense fallback={<p>Loading supplied results…</p>}>
      <Content params={params} />
    </Suspense>
  );
}
async function Content({ params }: { params: Promise<{ importId: string }> }) {
  const { importId } = await params;
  const s = await getSessionContext();
  const row = await new PrismaImportStore(getDb()).find(s.workspace.id, importId);
  if (!row) notFound();
  return (
    <div className="page-stack">
      <PageHeader
        title={row.fileName}
        description={`${row.engagement.name} · ${row.sourceTool} · ${row.status}`}
      />
      <ResearchSection id="provenance" title="Original source">
        <p className="text-sm break-all">SHA-256 {row.checksum}</p>
        <p>
          {row.parserVersion} · {row.mappingVersion}
        </p>
        {row.failureCode ? (
          <p role="alert">
            {row.failureCode}. The original content is retained; correct it in a new import.
          </p>
        ) : null}
        <details>
          <summary>Inspect original export</summary>
          <pre className="max-h-96 overflow-auto text-xs whitespace-pre-wrap">{row.rawContent}</pre>
        </details>
      </ResearchSection>
      {row.records.map((record) => {
        const p = canonicalResultSchema.safeParse(record.canonical);
        if (!p.success) return null;
        const c = p.data;
        return (
          <ResearchSection
            key={record.id}
            id={`result-${record.id}`}
            title={`${record.recordIndex + 1}. ${c.title}`}
          >
            <p className="whitespace-pre-wrap">{c.description}</p>
            <p className="text-sm text-muted-foreground">
              {c.assetReference ?? "Asset not mapped"} · {c.classification ?? "Unclassified"} · Tool
              severity: {c.severity ?? "not supplied"} · {record.status}
            </p>
            <details>
              <summary>Original record and duplicate candidates</summary>
              <pre className="max-h-64 overflow-auto text-xs whitespace-pre-wrap">
                {JSON.stringify(
                  { raw: record.rawRecord, duplicateCandidates: record.duplicateCandidates },
                  null,
                  2,
                )}
              </pre>
            </details>
            {record.status === "PENDING" ? (
              <ResearchActionForm
                action={reviewImportAction}
                hidden={{ recordId: record.id }}
                submitLabel="Record review"
                fields={[
                  {
                    name: "action",
                    label: "Review decision",
                    options: [
                      { value: "ADOPT_OBSERVATION", label: "Adopt as draft observation" },
                      { value: "ADOPT_FINDING", label: "Adopt as draft finding" },
                      { value: "REJECT", label: "Reject; retain original" },
                    ],
                  },
                  {
                    name: "investigationId",
                    label: "Investigation",
                    options: [
                      { value: "", label: "Choose for adoption" },
                      ...row.engagement.investigations.map((i) => ({
                        value: i.id,
                        label: i.title,
                      })),
                    ],
                  },
                  {
                    name: "assetId",
                    label: "Engagement asset",
                    options: [
                      { value: "", label: "Choose for adoption" },
                      ...row.engagement.assets.map((a) => ({
                        value: a.id,
                        label: `${a.target.name} (${a.target.assetIdentifier})`,
                      })),
                    ],
                  },
                  {
                    name: "rationale",
                    label: "Review rationale",
                    type: "textarea",
                    required: true,
                    maxLength: 8000,
                  },
                ]}
              />
            ) : (
              <p>{record.reviewRationale}</p>
            )}
          </ResearchSection>
        );
      })}
    </div>
  );
}
