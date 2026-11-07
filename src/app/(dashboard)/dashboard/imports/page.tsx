import Link from "next/link";
import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { PageHeader } from "@/components/shared/page-header";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchActionForm } from "@/components/research/research-action-form";
import { PrismaImportStore } from "@/modules/imports/infrastructure/prisma-import-store";
import { PrismaEngagementStore } from "@/modules/engagements/infrastructure/prisma-engagement-store";
import { createImportAction } from "./actions";
export const metadata = { title: "Tool imports" };
export default function ImportsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Tool imports"
        description="Review supplied tool exports while preserving their original records."
      />
      <Suspense fallback={<p>Loading imports…</p>}>
        <Content />
      </Suspense>
    </div>
  );
}
async function Content() {
  const s = await getSessionContext();
  const [imports, engagements] = await Promise.all([
    new PrismaImportStore(getDb()).list(s.workspace.id),
    new PrismaEngagementStore(getDb()).list(s.workspace.id),
  ]);
  return (
    <>
      <ResearchSection id="new-import" title="Import supplied results">
        <ResearchActionForm
          action={createImportAction}
          hidden={{ operationKey: randomUUID() }}
          submitLabel="Queue import"
          fields={[
            {
              name: "engagementId",
              label: "Engagement",
              required: true,
              options: engagements
                .filter((e) => e.status !== "ARCHIVED")
                .map((e) => ({ value: e.id, label: e.name })),
            },
            { name: "sourceTool", label: "Source tool", required: true, maxLength: 120 },
            {
              name: "format",
              label: "Export format",
              options: ["JSON", "CSV", "SARIF"].map((value) => ({
                value,
                label: value === "SARIF" ? "SARIF 2.1.0" : value,
              })),
            },
            {
              name: "importFile",
              label: "UTF-8 export file",
              type: "file",
              accept: ".json,.csv,.sarif",
              help: "Up to 500 KB and 1000 records.",
            },
            {
              name: "rawContent",
              label: "Or paste export content",
              type: "textarea",
              maxLength: 500000,
            },
            {
              name: "fieldMapping",
              label: "Field mapping (optional)",
              type: "textarea",
              maxLength: 2000,
              help: 'JSON and CSV use canonical field names by default. Example: {"title":"Name","assetReference":"Host","sourceRecordId":"ID"}. SARIF has its own parser.',
            },
          ]}
        />
      </ResearchSection>
      <ResearchSection id="import-history" title="Import history">
        {imports.length ? (
          <ul>
            {imports.map((i) => (
              <li key={i.id} className="border-b border-border py-4">
                <Link className="text-primary underline" href={`/dashboard/imports/${i.id}`}>
                  {i.fileName}
                </Link>
                <p>
                  {i.sourceTool} · {i.format} · {i.status} · {i._count.records} retained records
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No results imported yet.</p>
        )}
      </ResearchSection>
    </>
  );
}
