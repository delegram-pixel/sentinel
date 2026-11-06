"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";

import { createSessionSummaryAction } from "@/app/(dashboard)/dashboard/investigations/actions";
import {
  INITIAL_SESSION_SUMMARY_FORM_STATE,
  type SessionSummaryFormField,
  type SessionSummaryFormState,
} from "@/components/research/investigation-form-state";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

function FieldError({
  field,
  state,
  idPrefix,
}: {
  field: SessionSummaryFormField;
  state: SessionSummaryFormState;
  idPrefix: string;
}) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`${idPrefix}-summary-${field}-error`} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

export function SessionSummaryForm({
  investigationId,
  projectId,
}: {
  investigationId: string;
  projectId: string;
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(
    createSessionSummaryAction,
    INITIAL_SESSION_SUMMARY_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="investigationId" value={investigationId} />
        <input type="hidden" name="projectId" value={projectId} />

        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={Boolean(state.fieldErrors?.summary)}>
          <Label htmlFor={`${formId}-summary-text`}>Session summary</Label>
          <Textarea
            id={`${formId}-summary-text`}
            name="summary"
            required
            rows={4}
            maxLength={6000}
            placeholder="What happened in this session? What is the current state of the investigation?"
            defaultValue={state.values.summary}
            aria-invalid={Boolean(state.fieldErrors?.summary)}
            aria-describedby={
              state.fieldErrors?.summary ? `${formId}-summary-summary-error` : undefined
            }
          />
          <FieldError field="summary" state={state} idPrefix={formId} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.completedWork)}>
            <Label htmlFor={`${formId}-summary-completed`}>Completed work</Label>
            <Textarea
              id={`${formId}-summary-completed`}
              name="completedWork"
              rows={3}
              placeholder="One item per line"
              defaultValue={state.values.completedWork}
              aria-invalid={Boolean(state.fieldErrors?.completedWork)}
              aria-describedby={
                state.fieldErrors?.completedWork
                  ? `${formId}-summary-completedWork-error`
                  : undefined
              }
            />
            <FieldError field="completedWork" state={state} idPrefix={formId} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.rejectedHypotheses)}>
            <Label htmlFor={`${formId}-summary-rejected`}>Rejected hypotheses</Label>
            <Textarea
              id={`${formId}-summary-rejected`}
              name="rejectedHypotheses"
              rows={3}
              placeholder="One item per line"
              defaultValue={state.values.rejectedHypotheses}
              aria-invalid={Boolean(state.fieldErrors?.rejectedHypotheses)}
              aria-describedby={
                state.fieldErrors?.rejectedHypotheses
                  ? `${formId}-summary-rejectedHypotheses-error`
                  : undefined
              }
            />
            <FieldError field="rejectedHypotheses" state={state} idPrefix={formId} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.unresolvedQuestions)}>
            <Label htmlFor={`${formId}-summary-unresolved`}>Unresolved questions</Label>
            <Textarea
              id={`${formId}-summary-unresolved`}
              name="unresolvedQuestions"
              rows={3}
              placeholder="One item per line"
              defaultValue={state.values.unresolvedQuestions}
              aria-invalid={Boolean(state.fieldErrors?.unresolvedQuestions)}
              aria-describedby={
                state.fieldErrors?.unresolvedQuestions
                  ? `${formId}-summary-unresolvedQuestions-error`
                  : undefined
              }
            />
            <FieldError field="unresolvedQuestions" state={state} idPrefix={formId} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.nextActions)}>
            <Label htmlFor={`${formId}-summary-next`}>Next actions</Label>
            <Textarea
              id={`${formId}-summary-next`}
              name="nextActions"
              rows={3}
              placeholder="One item per line"
              defaultValue={state.values.nextActions}
              aria-invalid={Boolean(state.fieldErrors?.nextActions)}
              aria-describedby={
                state.fieldErrors?.nextActions ? `${formId}-summary-nextActions-error` : undefined
              }
            />
            <FieldError field="nextActions" state={state} idPrefix={formId} />
          </Field>
        </div>

        <Button type="submit" className="self-start" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : "Record session summary"}
        </Button>
      </FieldGroup>
    </form>
  );
}
