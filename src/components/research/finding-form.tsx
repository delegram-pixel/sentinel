"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  createFindingAction,
  updateFindingAction,
} from "@/app/(dashboard)/dashboard/findings/actions";
import {
  INITIAL_FINDING_FORM_STATE,
  type FindingFormField,
  type FindingFormState,
  type FindingFormValues,
} from "@/components/research/phase6-form-state";
import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Field, FieldGroup, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ASSET_TYPES } from "@/modules/research/domain/target";

type HypothesisOption = { id: string; title: string };

type FindingFormProps =
  | {
      mode: "create";
      investigationId: string;
      investigationTitle: string;
      hypotheses: HypothesisOption[];
    }
  | {
      mode: "edit";
      finding: {
        id: string;
        investigationId: string;
        title: string;
        description: string;
        vulnerabilityCategory: string | null;
        hypothesisId: string | null;
        affectedAsset: string | null;
        affectedAssetType: string | null;
        impact: string | null;
        remediation: string | null;
      };
      hypotheses: HypothesisOption[];
    };

function initialValues(props: FindingFormProps): FindingFormValues {
  if (props.mode === "create") {
    return INITIAL_FINDING_FORM_STATE.values;
  }

  return {
    title: props.finding.title,
    description: props.finding.description,
    vulnerabilityCategory: props.finding.vulnerabilityCategory ?? "",
    hypothesisId: props.finding.hypothesisId ?? "",
    affectedAsset: props.finding.affectedAsset ?? "",
    affectedAssetType: props.finding.affectedAssetType ?? "",
    impact: props.finding.impact ?? "",
    remediation: props.finding.remediation ?? "",
  };
}

function FieldMessage({ field, state }: { field: FindingFormField; state: FindingFormState }) {
  const message = state.fieldErrors?.[field];

  return message ? <FieldError id={`finding-${field}-error`}>{message}</FieldError> : null;
}

export function FindingForm(props: FindingFormProps) {
  const [state, formAction, pending] = useActionState(
    props.mode === "create" ? createFindingAction : updateFindingAction,
    { status: "idle", values: initialValues(props) },
  );
  const formRef = useFormErrorFocus(state);
  const investigationId =
    props.mode === "create" ? props.investigationId : props.finding.investigationId;
  const backHref =
    props.mode === "create"
      ? `/dashboard/investigations/${investigationId}`
      : `/dashboard/findings/${props.finding.id}`;

  return (
    <ResearchSection
      id="finding-form"
      title="Finding details"
      description={
        <>
          A finding is a candidate vulnerability. It can be confirmed only by a human reviewer and
          only after severity, affected asset, and supporting evidence are recorded.
        </>
      }
    >
      <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
        <FieldGroup>
          <input type="hidden" name="investigationId" value={investigationId} />
          {props.mode === "edit" ? (
            <input type="hidden" name="findingId" value={props.finding.id} />
          ) : null}

          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="finding-title">Title</FieldLabel>
              <Input
                id="finding-title"
                name="title"
                defaultValue={state.values.title}
                aria-invalid={Boolean(state.fieldErrors?.title)}
                aria-describedby={state.fieldErrors?.title ? `finding-title-error` : undefined}
                required
              />
              <FieldMessage field="title" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-category">Vulnerability category</FieldLabel>
              <Input
                id="finding-category"
                name="vulnerabilityCategory"
                defaultValue={state.values.vulnerabilityCategory}
                placeholder="e.g. Broken access control"
                aria-invalid={Boolean(state.fieldErrors?.vulnerabilityCategory)}
                aria-describedby={
                  state.fieldErrors?.vulnerabilityCategory
                    ? `finding-vulnerabilityCategory-error`
                    : undefined
                }
              />
              <FieldMessage field="vulnerabilityCategory" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-hypothesis">Hypothesis</FieldLabel>
              <Select
                id="finding-hypothesis"
                name="hypothesisId"
                defaultValue={state.values.hypothesisId}
                aria-invalid={Boolean(state.fieldErrors?.hypothesisId)}
                aria-describedby={
                  state.fieldErrors?.hypothesisId ? `finding-hypothesisId-error` : undefined
                }
              >
                <option value="">No linked hypothesis</option>
                {props.hypotheses.map((hypothesis) => (
                  <option key={hypothesis.id} value={hypothesis.id}>
                    {hypothesis.title}
                  </option>
                ))}
              </Select>
              <FieldMessage field="hypothesisId" state={state} />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="finding-description">Description</FieldLabel>
              <Textarea
                id="finding-description"
                name="description"
                defaultValue={state.values.description}
                aria-invalid={Boolean(state.fieldErrors?.description)}
                aria-describedby={
                  state.fieldErrors?.description ? `finding-description-error` : undefined
                }
                required
              />
              <FieldMessage field="description" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-asset">Affected asset</FieldLabel>
              <Input
                id="finding-asset"
                name="affectedAsset"
                defaultValue={state.values.affectedAsset}
                placeholder="Endpoint, host, or component"
                aria-invalid={Boolean(state.fieldErrors?.affectedAsset)}
                aria-describedby={
                  state.fieldErrors?.affectedAsset ? `finding-affectedAsset-error` : undefined
                }
              />
              <FieldMessage field="affectedAsset" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-asset-type">Affected asset type</FieldLabel>
              <Select
                id="finding-asset-type"
                name="affectedAssetType"
                defaultValue={state.values.affectedAssetType}
                aria-invalid={Boolean(state.fieldErrors?.affectedAssetType)}
                aria-describedby={
                  state.fieldErrors?.affectedAssetType
                    ? `finding-affectedAssetType-error`
                    : undefined
                }
              >
                <option value="">Not set</option>
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ").toLowerCase()}
                  </option>
                ))}
              </Select>
              <FieldMessage field="affectedAssetType" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-impact">Impact</FieldLabel>
              <Textarea
                id="finding-impact"
                name="impact"
                defaultValue={state.values.impact}
                className="min-h-24"
                aria-invalid={Boolean(state.fieldErrors?.impact)}
                aria-describedby={state.fieldErrors?.impact ? `finding-impact-error` : undefined}
              />
              <FieldMessage field="impact" state={state} />
            </Field>

            <Field>
              <FieldLabel htmlFor="finding-remediation">Remediation</FieldLabel>
              <Textarea
                id="finding-remediation"
                name="remediation"
                defaultValue={state.values.remediation}
                className="min-h-24"
                aria-invalid={Boolean(state.fieldErrors?.remediation)}
                aria-describedby={
                  state.fieldErrors?.remediation ? `finding-remediation-error` : undefined
                }
              />
              <FieldMessage field="remediation" state={state} />
            </Field>
          </FieldGroup>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-sm text-danger">
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button className="self-start" type="submit" disabled={pending}>
              {pending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
              ) : null}
              {pending ? "Saving…" : props.mode === "create" ? "Create finding" : "Save finding"}
            </Button>
            <Button type="button" variant="ghost" asChild>
              <Link href={backHref}>Cancel</Link>
            </Button>
          </div>
        </FieldGroup>
      </form>
    </ResearchSection>
  );
}
