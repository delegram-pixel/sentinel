"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";

import {
  createObservationAction,
  updateObservationAction,
} from "@/app/(dashboard)/dashboard/investigations/actions";
import {
  INITIAL_OBSERVATION_FORM_STATE,
  type ObservationFormField,
  type ObservationFormState,
} from "@/components/research/investigation-form-state";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ObservationRow } from "@/modules/research/application/ports";
import {
  CONFIDENCE_LABELS,
  CONFIDENCE_LABEL_LABELS,
  OBSERVATION_TYPES,
  OBSERVATION_TYPE_LABELS,
} from "@/modules/research/domain/investigation";

type ObservationFormProps =
  | {
      mode: "create";
      investigationId: string;
      projectId: string;
    }
  | {
      mode: "edit";
      investigationId: string;
      projectId: string;
      observation: ObservationRow;
    };

function initialState(observation: ObservationRow | undefined): ObservationFormState {
  if (!observation) {
    return INITIAL_OBSERVATION_FORM_STATE;
  }

  return {
    status: "idle",
    values: {
      title: observation.title,
      description: observation.description,
      observationType: observation.observationType,
      source: observation.source ?? "",
      confidenceLabel: observation.confidenceLabel,
    },
  };
}

function FieldError({
  field,
  state,
  idPrefix,
}: {
  field: ObservationFormField;
  state: ObservationFormState;
  idPrefix: string;
}) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`${idPrefix}-observation-${field}-error`} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

export function ObservationForm(props: ObservationFormProps) {
  const formId = useId();
  const action = props.mode === "create" ? createObservationAction : updateObservationAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialState(props.mode === "edit" ? props.observation : undefined),
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="investigationId" value={props.investigationId} />
        <input type="hidden" name="projectId" value={props.projectId} />
        {props.mode === "edit" ? (
          <input type="hidden" name="observationId" value={props.observation.id} />
        ) : null}

        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={Boolean(state.fieldErrors?.title)}>
          <Label htmlFor={`${formId}-observation-title`}>Title</Label>
          <Input
            id={`${formId}-observation-title`}
            name="title"
            required
            minLength={2}
            maxLength={150}
            autoComplete="off"
            defaultValue={state.values.title}
            aria-invalid={Boolean(state.fieldErrors?.title)}
            aria-describedby={
              state.fieldErrors?.title ? `${formId}-observation-title-error` : undefined
            }
          />
          <FieldError field="title" state={state} idPrefix={formId} />
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.description)}>
          <Label htmlFor={`${formId}-observation-description`}>Observation</Label>
          <Textarea
            id={`${formId}-observation-description`}
            name="description"
            required
            rows={4}
            maxLength={5000}
            placeholder="Record what you observed, not what you think it means."
            defaultValue={state.values.description}
            aria-invalid={Boolean(state.fieldErrors?.description)}
            aria-describedby={
              state.fieldErrors?.description ? `${formId}-observation-description-error` : undefined
            }
          />
          <FieldError field="description" state={state} idPrefix={formId} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.observationType)}>
            <Label htmlFor={`${formId}-observation-type`}>Type</Label>
            <Select
              id={`${formId}-observation-type`}
              name="observationType"
              defaultValue={state.values.observationType}
              aria-invalid={Boolean(state.fieldErrors?.observationType)}
              aria-describedby={
                state.fieldErrors?.observationType
                  ? `${formId}-observation-observationType-error`
                  : undefined
              }
            >
              {OBSERVATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {OBSERVATION_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            <FieldError field="observationType" state={state} idPrefix={formId} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.confidenceLabel)}>
            <Label htmlFor={`${formId}-observation-confidence`}>Confidence</Label>
            <Select
              id={`${formId}-observation-confidence`}
              name="confidenceLabel"
              defaultValue={state.values.confidenceLabel}
              aria-invalid={Boolean(state.fieldErrors?.confidenceLabel)}
              aria-describedby={
                state.fieldErrors?.confidenceLabel
                  ? `${formId}-observation-confidenceLabel-error`
                  : undefined
              }
            >
              {CONFIDENCE_LABELS.map((label) => (
                <option key={label} value={label}>
                  {CONFIDENCE_LABEL_LABELS[label]}
                </option>
              ))}
            </Select>
            <FieldError field="confidenceLabel" state={state} idPrefix={formId} />
          </Field>
        </div>

        <Field data-invalid={Boolean(state.fieldErrors?.source)}>
          <Label htmlFor={`${formId}-observation-source`}>Source</Label>
          <Input
            id={`${formId}-observation-source`}
            name="source"
            maxLength={200}
            autoComplete="off"
            placeholder="Request, response, note reference, or tool"
            defaultValue={state.values.source}
            aria-invalid={Boolean(state.fieldErrors?.source)}
            aria-describedby={
              state.fieldErrors?.source ? `${formId}-observation-source-error` : undefined
            }
          />
          <FieldError field="source" state={state} idPrefix={formId} />
        </Field>

        <Button type="submit" className="self-start" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : props.mode === "create" ? "Add observation" : "Save observation"}
        </Button>
      </FieldGroup>
    </form>
  );
}
