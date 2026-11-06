"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import {
  createTargetAction,
  updateTargetAction,
} from "@/app/(dashboard)/dashboard/projects/[projectId]/targets/actions";
import {
  INITIAL_TARGET_FORM_STATE,
  type TargetFormField,
  type TargetFormState,
} from "@/components/research/target-form-state";
import { Field, FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/lib/format";
import {
  ASSET_TYPES,
  ASSET_TYPE_LABELS,
  ENVIRONMENT_TYPES,
  ENVIRONMENT_TYPE_LABELS,
  type AssetType,
  type EnvironmentType,
} from "@/modules/research/domain/target";

type TargetFormProject = {
  id: string;
  name: string;
};

type TargetFormTarget = {
  id: string;
  name: string;
  description: string | null;
  assetIdentifier: string;
  assetType: AssetType;
  environmentType: EnvironmentType;
  programName: string | null;
  programUrl: string | null;
  authorizationSource: string | null;
  authorizationDate: Date | null;
  authorizationNotes: string | null;
};

type TargetFormProps =
  | { mode: "create"; project: TargetFormProject; target?: undefined }
  | { mode: "edit"; project: TargetFormProject; target: TargetFormTarget };

function initialValues(target: TargetFormTarget | undefined): TargetFormState {
  if (!target) {
    return INITIAL_TARGET_FORM_STATE;
  }

  return {
    status: "idle",
    values: {
      name: target.name,
      description: target.description ?? "",
      assetIdentifier: target.assetIdentifier,
      assetType: target.assetType,
      environmentType: target.environmentType,
      programName: target.programName ?? "",
      programUrl: target.programUrl ?? "",
      authorizationSource: target.authorizationSource ?? "",
      authorizationDate: toDateInputValue(target.authorizationDate),
      authorizationNotes: target.authorizationNotes ?? "",
    },
  };
}

function FieldError({ field, state }: { field: TargetFormField; state: TargetFormState }) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`target-${field}-error`} className="text-xs text-danger">
      {message}
    </p>
  );
}

function describedBy(field: TargetFormField, state: TargetFormState, hint = false) {
  if (state.fieldErrors?.[field]) {
    return `target-${field}-error`;
  }

  return hint ? `target-${field}-hint` : undefined;
}

export function TargetForm(props: TargetFormProps) {
  const action = props.mode === "create" ? createTargetAction : updateTargetAction;
  const [state, formAction, pending] = useActionState(action, initialValues(props.target));
  const formRef = useFormErrorFocus(state);

  const actionBasePath =
    props.mode === "edit"
      ? `/dashboard/projects/${props.project.id}/targets/${props.target.id}`
      : `/dashboard/projects/${props.project.id}/targets`;

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <input type="hidden" name="projectId" value={props.project.id} />
      {props.mode === "edit" ? (
        <input type="hidden" name="targetId" value={props.target.id} />
      ) : null}

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <ResearchSection
        id="form-asset"
        title="Asset"
        description={
          <>
            {" "}
            Identify the exact asset and the environment it belongs to. The asset identifier must be
            unique inside {props.project.name}.{" "}
          </>
        }
      >
        <FieldGroup>
          <Field data-invalid={Boolean(state.fieldErrors?.name)}>
            <Label htmlFor="target-name">Name</Label>
            <Input
              id="target-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
              defaultValue={state.values.name}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              aria-describedby={describedBy("name", state)}
            />
            <FieldError field="name" state={state} />
          </Field>

          <Field data-invalid={Boolean(state.fieldErrors?.assetIdentifier)}>
            <Label htmlFor="asset-identifier">Asset identifier</Label>
            <Input
              id="asset-identifier"
              name="assetIdentifier"
              required
              maxLength={255}
              autoComplete="off"
              spellCheck={false}
              placeholder="app.example.test or 10.0.0.0/24"
              defaultValue={state.values.assetIdentifier}
              aria-invalid={Boolean(state.fieldErrors?.assetIdentifier)}
              aria-describedby={describedBy("assetIdentifier", state, true)}
            />
            <p id="target-assetIdentifier-hint" className="text-xs text-muted-foreground">
              Only use assets you own or are explicitly authorized to test.
            </p>
            <FieldError field="assetIdentifier" state={state} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fieldErrors?.assetType)}>
              <Label htmlFor="asset-type">Asset type</Label>
              <Select
                id="asset-type"
                name="assetType"
                defaultValue={state.values.assetType}
                aria-invalid={Boolean(state.fieldErrors?.assetType)}
                aria-describedby={describedBy("assetType", state)}
              >
                {ASSET_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ASSET_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
              <FieldError field="assetType" state={state} />
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.environmentType)}>
              <Label htmlFor="environment-type">Environment</Label>
              <Select
                id="environment-type"
                name="environmentType"
                defaultValue={state.values.environmentType}
                aria-invalid={Boolean(state.fieldErrors?.environmentType)}
                aria-describedby={describedBy("environmentType", state)}
              >
                {ENVIRONMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ENVIRONMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
              <FieldError field="environmentType" state={state} />
            </Field>
          </div>

          <Field data-invalid={Boolean(state.fieldErrors?.description)}>
            <Label htmlFor="target-description">Description</Label>
            <Textarea
              id="target-description"
              name="description"
              rows={4}
              maxLength={2000}
              placeholder="What does this asset expose, and what is the research question?"
              defaultValue={state.values.description}
              aria-invalid={Boolean(state.fieldErrors?.description)}
              aria-describedby={describedBy("description", state)}
            />
            <FieldError field="description" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <ResearchSection
        id="form-authorization-context"
        title="Authorization context"
        description={
          <>
            {" "}
            Record where the permission comes from. This does not activate scope: scope versions are
            created and approved separately.{" "}
          </>
        }
      >
        <FieldGroup>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fieldErrors?.programName)}>
              <Label htmlFor="program-name">Program name</Label>
              <Input
                id="program-name"
                name="programName"
                maxLength={120}
                autoComplete="off"
                defaultValue={state.values.programName}
                aria-invalid={Boolean(state.fieldErrors?.programName)}
                aria-describedby={describedBy("programName", state)}
              />
              <FieldError field="programName" state={state} />
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.programUrl)}>
              <Label htmlFor="program-url">Program URL</Label>
              <Input
                id="program-url"
                name="programUrl"
                type="url"
                maxLength={500}
                autoComplete="url"
                placeholder="https://"
                defaultValue={state.values.programUrl}
                aria-invalid={Boolean(state.fieldErrors?.programUrl)}
                aria-describedby={describedBy("programUrl", state)}
              />
              <FieldError field="programUrl" state={state} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fieldErrors?.authorizationSource)}>
              <Label htmlFor="authorization-source">Authorization source</Label>
              <Input
                id="authorization-source"
                name="authorizationSource"
                maxLength={300}
                autoComplete="off"
                placeholder="Self-attested local lab, program policy, signed letter…"
                defaultValue={state.values.authorizationSource}
                aria-invalid={Boolean(state.fieldErrors?.authorizationSource)}
                aria-describedby={describedBy("authorizationSource", state)}
              />
              <FieldError field="authorizationSource" state={state} />
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.authorizationDate)}>
              <Label htmlFor="authorization-date">Authorization date</Label>
              <Input
                id="authorization-date"
                name="authorizationDate"
                type="date"
                defaultValue={state.values.authorizationDate}
                aria-invalid={Boolean(state.fieldErrors?.authorizationDate)}
                aria-describedby={describedBy("authorizationDate", state)}
              />
              <FieldError field="authorizationDate" state={state} />
            </Field>
          </div>

          <Field data-invalid={Boolean(state.fieldErrors?.authorizationNotes)}>
            <Label htmlFor="authorization-notes">Authorization notes</Label>
            <Textarea
              id="authorization-notes"
              name="authorizationNotes"
              rows={4}
              maxLength={2000}
              placeholder="Limits, exclusions, or reporting requirements that apply to this asset."
              defaultValue={state.values.authorizationNotes}
              aria-invalid={Boolean(state.fieldErrors?.authorizationNotes)}
              aria-describedby={describedBy("authorizationNotes", state)}
            />
            <FieldError field="authorizationNotes" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending
            ? props.mode === "create"
              ? "Registering…"
              : "Saving…"
            : props.mode === "create"
              ? "Register target"
              : "Save changes"}
        </Button>
        <Button asChild variant="outline">
          <Link href={actionBasePath}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
