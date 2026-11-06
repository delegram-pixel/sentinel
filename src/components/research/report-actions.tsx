"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState } from "react";

import {
  approveReportAction,
  archiveReportAction,
  exportReportAction,
  reopenReportAction,
  submitReportAction,
  saveReportRevisionAction,
} from "@/app/(dashboard)/dashboard/reports/actions";
import {
  INITIAL_REPORT_CONTENT_FORM_STATE,
  INITIAL_REPORT_STATUS_FORM_STATE,
  type ReportContentFormState,
  type ReportStatusFormState,
} from "@/components/research/report-form-state";
import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";

function Message({ state }: { state: ReportStatusFormState | ReportContentFormState }) {
  return state.status === "error" && state.message ? (
    <p role="alert" className="text-xs text-danger">
      {state.message}
    </p>
  ) : null;
}

const STATUS_ACTIONS = {
  submit: submitReportAction,
  approve: approveReportAction,
  reopen: reopenReportAction,
  archive: archiveReportAction,
  "export-markdown": exportReportAction,
  "export-pdf": exportReportAction,
} as const;

export type ReportStatusActionKind = keyof typeof STATUS_ACTIONS;

const ACTION_LABELS: Record<
  ReportStatusActionKind,
  { idle: string; pending: string; variant: "default" | "outline" | "ghost"; format?: string }
> = {
  submit: { idle: "Submit for review", pending: "Submitting…", variant: "default" },
  approve: { idle: "Approve report", pending: "Approving…", variant: "default" },
  reopen: { idle: "Return to draft", pending: "Reopening…", variant: "outline" },
  archive: { idle: "Archive report", pending: "Archiving…", variant: "ghost" },
  "export-markdown": {
    idle: "Export Markdown",
    pending: "Preparing…",
    variant: "default",
    format: "MARKDOWN",
  },
  "export-pdf": { idle: "Export PDF", pending: "Preparing…", variant: "outline", format: "PDF" },
};

export function ReportStatusAction({
  kind,
  reportId,
  investigationId,
}: {
  kind: ReportStatusActionKind;
  reportId: string;
  investigationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    STATUS_ACTIONS[kind],
    INITIAL_REPORT_STATUS_FORM_STATE,
  );
  const labels = ACTION_LABELS[kind];

  return (
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-2">
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="investigationId" value={investigationId} />
      {labels.format ? <input type="hidden" name="format" value={labels.format} /> : null}
      <Button type="submit" variant={labels.variant} size="sm" disabled={pending}>
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? labels.pending : labels.idle}
      </Button>
      <Message state={state} />
    </form>
  );
}

export function ReportRevisionForm({
  reportId,
  investigationId,
  content,
  version,
}: {
  reportId: string;
  investigationId: string;
  content: string;
  version: number;
}) {
  const [state, formAction, pending] = useActionState(
    saveReportRevisionAction,
    INITIAL_REPORT_CONTENT_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <Field>
          <FieldLabel htmlFor="report-content">Report content (Markdown)</FieldLabel>
          <Textarea
            id="report-content"
            name="content"
            defaultValue={state.status === "error" ? state.values.content : content}
            className="min-h-96 font-mono text-xs"
            aria-invalid={state.status === "error"}
          />
          {state.status === "error" && state.message ? (
            <FieldError>{state.message}</FieldError>
          ) : null}
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Saving…" : `Save revision ${version + 1}`}
          </Button>
          <span className="text-xs text-text-secondary">
            Saving creates an immutable revision. Earlier revisions are kept.
          </span>
        </div>
      </FieldGroup>
    </form>
  );
}
