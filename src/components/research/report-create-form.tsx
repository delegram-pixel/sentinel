"use client";

import { FieldHelpLabel } from "@/components/shared/field-help-label";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import { createReportAction } from "@/app/(dashboard)/dashboard/reports/actions";
import {
  INITIAL_REPORT_CREATE_FORM_STATE,
  type ReportCreateFormState,
  type ReportCreateFormValues,
} from "@/components/research/report-form-state";
import { FindingStatusBadge, SeverityBadge } from "@/components/research/phase6-badges";
import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { ReportFindingInput } from "@/modules/reports/domain/report";
import type { ReportTemplateRow } from "@/modules/reports/application/ports";

function errorFor(state: ReportCreateFormState, field: keyof ReportCreateFormValues) {
  const message = state.fieldErrors?.[field];

  return message ? <FieldError>{message}</FieldError> : null;
}

export function ReportCreateForm({
  investigationId,
  investigationTitle,
  findings,
  templates,
  initialFindingId,
}: {
  investigationId: string;
  investigationTitle: string;
  findings: ReportFindingInput[];
  templates: ReportTemplateRow[];
  initialFindingId?: string;
}) {
  const [state, formAction, pending] = useActionState(
    createReportAction,
    INITIAL_REPORT_CREATE_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const defaultTitle =
    state.status === "error" ? state.values.title : `${investigationTitle} report`;
  const selectedIds =
    state.status === "error" ? state.values.findingIds : initialFindingId ? [initialFindingId] : [];
  const selectedTemplateId = state.status === "error" ? state.values.templateId : "";

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <input type="hidden" name="investigationId" value={investigationId} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="report-title">Report title</FieldLabel>
          <Input
            id="report-title"
            name="title"
            defaultValue={defaultTitle}
            aria-invalid={Boolean(state.fieldErrors?.title)}
            placeholder="Web application assessment report"
          />
          {errorFor(state, "title")}
        </Field>

        <Field>
          <FieldHelpLabel
            htmlFor="report-template"
            help={{
              description:
                "Choose the structure and sections used to build the report draft. The template organizes the material; it does not approve the findings or the resulting report.",
              example:
                "Choose a template suited to the intended audience, then review the selected findings and generated narrative before approval.",
              note: "Report revisions retain history. Export requires human approval and ready source records.",
            }}
          >
            Report template
          </FieldHelpLabel>
          <Select
            id="report-template"
            name="templateId"
            defaultValue={selectedTemplateId}
            aria-invalid={Boolean(state.fieldErrors?.templateId)}
          >
            <option value="">Built-in standard sections</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} (v{template.version}, {template.scope.toLowerCase()})
              </option>
            ))}
          </Select>
          <FieldDescription>
            Required sections stay in every report. Workspace templates are managed on the report
            templates page.
          </FieldDescription>
          {errorFor(state, "templateId")}
        </Field>

        <FieldSet>
          <FieldLegend>Findings to include</FieldLegend>
          <FieldDescription>
            Only confirmed or reportable findings are available. Each finding must have severity,
            impact, remediation, an affected asset, and approved supporting evidence.
          </FieldDescription>
          <div className="mt-3 flex flex-col gap-2">
            {findings.map((finding) => (
              <label
                key={finding.id}
                className="flex cursor-pointer items-start gap-3 rounded-sm border border-control-border bg-surface-elevated p-3"
              >
                <input
                  type="checkbox"
                  name="findingIds"
                  value={finding.id}
                  defaultChecked={selectedIds.includes(finding.id)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">{finding.title}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <FindingStatusBadge status={finding.status} />
                    <SeverityBadge severity={finding.severity} />
                    <span className="text-xs text-text-secondary">
                      {finding.evidence.length} approved evidence reference
                      {finding.evidence.length === 1 ? "" : "s"}
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </div>
          {errorFor(state, "findingIds")}
        </FieldSet>

        {state.status === "error" && state.message ? (
          <p role="alert" className="text-xs text-danger">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Creating…" : "Create draft report"}
        </Button>
      </FieldGroup>
    </form>
  );
}
