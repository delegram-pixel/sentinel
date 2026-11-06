import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { toggleReportTemplateAction } from "@/app/(dashboard)/dashboard/reports/templates/actions";
import { ReportTemplateForm } from "@/components/research/report-template-form";
import { Disclosure } from "@/components/shared/disclosure";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RecordListSkeleton } from "@/components/shared/record-list-skeleton";
import { RecordTable } from "@/components/shared/record-table";
import { ResearchSection } from "@/components/shared/research-section";
import { ResearchTime } from "@/components/shared/research-time";
import { StatusLabel } from "@/components/shared/status-label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { canManageReportTemplates } from "@/modules/reports/domain/report";
import { listReportTemplates } from "@/modules/reports/application/report-service";
import { PrismaReportStore } from "@/modules/reports/infrastructure/prisma-report-store";

export const metadata: Metadata = {
  title: "Report templates",
};

export const instant = false;

export default function ReportTemplatesPage() {
  return (
    <Suspense fallback={<RecordListSkeleton label="Loading report templates" />}>
      <ReportTemplatesContent />
    </Suspense>
  );
}

async function ReportTemplatesContent() {
  const session = await getSessionContext();
  const templates = await listReportTemplates(new PrismaReportStore(getDb()), session.workspace.id);
  const canManage = canManageReportTemplates(session.role);
  const systemTemplates = templates.filter((template) => template.scope === "SYSTEM");
  const workspaceTemplates = templates.filter((template) => template.scope === "WORKSPACE");

  return (
    <div className="page-stack">
      <Link href="/dashboard/reports" className="record-link w-fit text-sm text-text-secondary">
        All reports
      </Link>
      <PageHeader
        title="Report templates"
        description="Templates control the section order of a new report. Required sections cannot be removed, and template changes never rewrite a saved report revision."
        actions={
          <Button asChild variant="outline">
            <Link href="/dashboard/reports/new">New report</Link>
          </Button>
        }
      />

      <Alert>
        <AlertTitle>Required sections are protected</AlertTitle>
        <AlertDescription>
          Every template keeps Summary, Findings, Evidence references, Assumptions and limitations,
          and Missing information. Workspace templates can add Methodology and Recommendations.
        </AlertDescription>
      </Alert>

      <ResearchSection
        id="system-report-templates"
        title="System templates"
        description="Read-only templates available to every workspace."
      >
        {systemTemplates.length ? (
          <TemplateTable templates={systemTemplates} canManage={false} />
        ) : (
          <EmptyState
            title="System templates are not available"
            description="Run the pending database migration to seed the system report templates."
          />
        )}
      </ResearchSection>

      <ResearchSection
        id="workspace-report-templates"
        title="Workspace templates"
        description="Owner- or administrator-managed templates for this workspace. Creating a template with an existing name saves a new version."
        action={
          canManage ? (
            <StatusLabel tone="success">You can manage templates</StatusLabel>
          ) : (
            <StatusLabel tone="secondary">Owner or administrator required</StatusLabel>
          )
        }
      >
        {workspaceTemplates.length ? (
          <TemplateTable templates={workspaceTemplates} canManage={canManage} />
        ) : (
          <EmptyState
            title="No workspace templates"
            description="Create a workspace template to add optional sections or keep a named layout for future reports."
          />
        )}

        {canManage ? (
          <div className="mt-6">
            <Disclosure title="Create a workspace template">
              <ReportTemplateForm />
            </Disclosure>
          </div>
        ) : null}
      </ResearchSection>
    </div>
  );
}

function TemplateTable({
  templates,
  canManage,
}: {
  templates: Awaited<ReturnType<typeof listReportTemplates>>;
  canManage: boolean;
}) {
  return (
    <RecordTable caption="Report templates" minWidth="46rem">
      <thead>
        <tr>
          <th scope="col">Template</th>
          <th scope="col">Scope</th>
          <th scope="col">Sections</th>
          <th scope="col">Version</th>
          <th scope="col">Status</th>
          <th scope="col">Updated</th>
          {canManage ? <th scope="col">Action</th> : null}
        </tr>
      </thead>
      <tbody>
        {templates.map((template) => (
          <tr key={template.id}>
            <td className="max-w-64 break-words">{template.name}</td>
            <td>
              <StatusLabel tone={template.scope === "SYSTEM" ? "secondary" : "neutral"}>
                {template.scope === "SYSTEM" ? "System" : "Workspace"}
              </StatusLabel>
            </td>
            <td className="max-w-80 text-xs leading-relaxed text-text-secondary">
              {template.sections.map((section) => section.title).join(" · ")}
            </td>
            <td className="font-mono text-xs">v{template.version}</td>
            <td>
              <StatusLabel tone={template.isActive ? "success" : "secondary"}>
                {template.isActive ? "Active" : "Inactive"}
              </StatusLabel>
            </td>
            <td>
              <ResearchTime date={template.updatedAt} />
            </td>
            {canManage ? (
              <td>
                {template.scope === "WORKSPACE" ? (
                  <form action={toggleReportTemplateAction}>
                    <input type="hidden" name="templateId" value={template.id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={template.isActive ? "false" : "true"}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      {template.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                ) : (
                  <span className="text-xs text-text-secondary">Read-only</span>
                )}
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </RecordTable>
  );
}
