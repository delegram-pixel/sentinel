"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";

import {
  changeHypothesisStatusAction,
  changeInvestigationStatusAction,
} from "@/app/(dashboard)/dashboard/investigations/actions";
import { INITIAL_STATUS_FORM_STATE } from "@/components/research/investigation-form-state";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { canTransitionHypothesis } from "@/modules/hypotheses/domain/hypothesis-status";
import {
  canTransitionInvestigation,
  HYPOTHESIS_STATUSES,
  HYPOTHESIS_STATUS_LABELS,
  INVESTIGATION_STATUSES,
  INVESTIGATION_STATUS_LABELS,
  type HypothesisStatus,
  type InvestigationStatus,
} from "@/modules/research/domain/investigation";

export function InvestigationStatusForm({
  investigationId,
  projectId,
  currentStatus,
}: {
  investigationId: string;
  projectId: string;
  currentStatus: InvestigationStatus;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    changeInvestigationStatusAction,
    INITIAL_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const nextStatuses = INVESTIGATION_STATUSES.filter((status) =>
    canTransitionInvestigation(currentStatus, status),
  );
  if (!nextStatuses.length)
    return (
      <p className="text-sm text-text-secondary">
        This investigation is archived. Its history remains available.
      </p>
    );
  return (
    <form ref={formRef} action={formAction} aria-busy={pending}>
      <FieldGroup>
        <input type="hidden" name="investigationId" value={investigationId} />
        <input type="hidden" name="projectId" value={projectId} />
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor={id}>Move to status</FieldLabel>
            <Select id={id} name="status" defaultValue={nextStatuses[0]}>
              {nextStatuses.map((status) => (
                <option key={status} value={status}>
                  {INVESTIGATION_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Updating…" : "Update status"}
          </Button>
        </div>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </FieldGroup>
    </form>
  );
}

export function HypothesisStatusForm({
  investigationId,
  projectId,
  hypothesisId,
  currentStatus,
}: {
  investigationId: string;
  projectId: string;
  hypothesisId: string;
  currentStatus: HypothesisStatus;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(
    changeHypothesisStatusAction,
    INITIAL_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const nextStatuses = HYPOTHESIS_STATUSES.filter((status) =>
    canTransitionHypothesis(currentStatus, status, "RESEARCHER"),
  );
  if (!nextStatuses.length) return null;
  return (
    <form ref={formRef} action={formAction} aria-busy={pending}>
      <FieldGroup>
        <input type="hidden" name="investigationId" value={investigationId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="hypothesisId" value={hypothesisId} />
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor={id}>Next status</FieldLabel>
            <Select id={id} name="status" defaultValue={nextStatuses[0]}>
              {nextStatuses.map((status) => (
                <option key={status} value={status}>
                  {HYPOTHESIS_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Updating…" : "Update status"}
          </Button>
        </div>
        {state.status === "error" && state.message ? (
          <p role="alert" className="text-sm text-danger">
            {state.message}
          </p>
        ) : null}
      </FieldGroup>
    </form>
  );
}
