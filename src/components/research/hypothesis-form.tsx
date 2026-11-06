"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import { useActionState, useId } from "react";

import {
  createHypothesisAction,
  updateHypothesisAction,
} from "@/app/(dashboard)/dashboard/investigations/actions";
import {
  INITIAL_HYPOTHESIS_FORM_STATE,
  type HypothesisFormField,
  type HypothesisFormState,
} from "@/components/research/investigation-form-state";
import { Field, FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { HypothesisRow, ObservationRow } from "@/modules/research/application/ports";
import {
  HYPOTHESIS_OBSERVATION_RELATIONSHIPS,
  HYPOTHESIS_OBSERVATION_RELATIONSHIP_LABELS,
} from "@/modules/research/domain/investigation";

type HypothesisFormProps =
  | {
      mode: "create";
      investigationId: string;
      projectId: string;
      observations: ObservationRow[];
    }
  | {
      mode: "edit";
      investigationId: string;
      projectId: string;
      hypothesis: HypothesisRow;
    };

function initialState(hypothesis: HypothesisRow | undefined): HypothesisFormState {
  if (!hypothesis) {
    return INITIAL_HYPOTHESIS_FORM_STATE;
  }

  return {
    status: "idle",
    values: {
      title: hypothesis.title,
      description: hypothesis.description,
      vulnerabilityCategory: hypothesis.vulnerabilityCategory ?? "",
      missingInformation: hypothesis.missingInformation ?? "",
      observationLinks: Object.fromEntries(
        hypothesis.observationLinks.map((link) => [link.observationId, link.relationshipType]),
      ),
    },
  };
}

function FieldError({
  field,
  state,
  idPrefix,
}: {
  field: HypothesisFormField;
  state: HypothesisFormState;
  idPrefix: string;
}) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`${idPrefix}-hypothesis-${field}-error`} role="alert" className="text-xs text-danger">
      {message}
    </p>
  );
}

export function HypothesisForm(props: HypothesisFormProps) {
  const formId = useId();
  const action = props.mode === "create" ? createHypothesisAction : updateHypothesisAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialState(props.mode === "edit" ? props.hypothesis : undefined),
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="investigationId" value={props.investigationId} />
        <input type="hidden" name="projectId" value={props.projectId} />
        {props.mode === "edit" ? (
          <input type="hidden" name="hypothesisId" value={props.hypothesis.id} />
        ) : null}

        {state.status === "error" && state.message ? (
          <Alert variant="destructive">
            <AlertDescription>{state.message}</AlertDescription>
          </Alert>
        ) : null}

        <Field data-invalid={Boolean(state.fieldErrors?.title)}>
          <Label htmlFor={`${formId}-hypothesis-title`}>Title</Label>
          <Input
            id={`${formId}-hypothesis-title`}
            name="title"
            required
            minLength={2}
            maxLength={150}
            autoComplete="off"
            placeholder="What do you suspect is wrong?"
            defaultValue={state.values.title}
            aria-invalid={Boolean(state.fieldErrors?.title)}
            aria-describedby={
              state.fieldErrors?.title ? `${formId}-hypothesis-title-error` : undefined
            }
          />
          <FieldError field="title" state={state} idPrefix={formId} />
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.description)}>
          <Label htmlFor={`${formId}-hypothesis-description`}>Reasoning</Label>
          <Textarea
            id={`${formId}-hypothesis-description`}
            name="description"
            required
            rows={4}
            maxLength={5000}
            placeholder="Explain the suspected issue and why it may be exploitable."
            defaultValue={state.values.description}
            aria-invalid={Boolean(state.fieldErrors?.description)}
            aria-describedby={
              state.fieldErrors?.description ? `${formId}-hypothesis-description-error` : undefined
            }
          />
          <FieldError field="description" state={state} idPrefix={formId} />
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.vulnerabilityCategory)}>
          <Label htmlFor={`${formId}-hypothesis-category`}>Vulnerability category</Label>
          <Input
            id={`${formId}-hypothesis-category`}
            name="vulnerabilityCategory"
            maxLength={80}
            autoComplete="off"
            placeholder="Broken access control, SSRF, information disclosure…"
            defaultValue={state.values.vulnerabilityCategory}
            aria-invalid={Boolean(state.fieldErrors?.vulnerabilityCategory)}
            aria-describedby={
              state.fieldErrors?.vulnerabilityCategory
                ? `${formId}-hypothesis-vulnerabilityCategory-error`
                : undefined
            }
          />
          <FieldError field="vulnerabilityCategory" state={state} idPrefix={formId} />
        </Field>

        <Field data-invalid={Boolean(state.fieldErrors?.missingInformation)}>
          <Label htmlFor={`${formId}-hypothesis-missing`}>Missing information</Label>
          <Textarea
            id={`${formId}-hypothesis-missing`}
            name="missingInformation"
            rows={3}
            maxLength={2000}
            placeholder="What evidence would confirm or reject this hypothesis?"
            defaultValue={state.values.missingInformation}
            aria-invalid={Boolean(state.fieldErrors?.missingInformation)}
            aria-describedby={
              state.fieldErrors?.missingInformation
                ? `${formId}-hypothesis-missingInformation-error`
                : undefined
            }
          />
          <FieldError field="missingInformation" state={state} idPrefix={formId} />
        </Field>

        {props.mode === "create" ? (
          <FieldSet className="form-stack">
            <FieldLegend className="text-sm font-medium">Link observations</FieldLegend>
            {props.observations.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Add observations first to link them when creating this hypothesis.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {props.observations.map((observation) => (
                  <div
                    key={observation.id}
                    className="grid gap-3 border-b border-border py-3 sm:grid-cols-[1fr_11rem] sm:items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{observation.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {observation.observationType.replaceAll("_", " ").toLowerCase()}
                      </p>
                    </div>
                    <Select
                      aria-label={`Relationship to ${observation.title}`}
                      name={`link:${observation.id}`}
                      defaultValue={state.values.observationLinks[observation.id] ?? ""}
                    >
                      <option value="">No link</option>
                      {HYPOTHESIS_OBSERVATION_RELATIONSHIPS.map((relationship) => (
                        <option key={relationship} value={relationship}>
                          {HYPOTHESIS_OBSERVATION_RELATIONSHIP_LABELS[relationship]}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </FieldSet>
        ) : null}

        <Button type="submit" className="self-start" size="sm" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : props.mode === "create" ? "Add hypothesis" : "Save hypothesis"}
        </Button>
      </FieldGroup>
    </form>
  );
}
