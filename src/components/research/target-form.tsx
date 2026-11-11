"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  createTargetAction,
  updateTargetAction,
} from "@/app/(dashboard)/dashboard/projects/[projectId]/targets/actions";
import {
  INITIAL_TARGET_FORM_STATE,
  type TargetFormField,
  type TargetFormState,
} from "@/components/research/target-form-state";
import { ChoiceCards } from "@/components/shared/choice-cards";
import { Disclosure } from "@/components/shared/disclosure";
import { FieldHint } from "@/components/shared/field-hint";
import { ResearchSection } from "@/components/shared/research-section";
import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toDateInputValue } from "@/lib/format";
import {
  ASSET_TYPES,
  ASSET_TYPE_GUIDANCE,
  ASSET_TYPE_LABELS,
  AUTHORIZATION_SOURCE_SUGGESTIONS,
  ENVIRONMENT_TYPES,
  ENVIRONMENT_TYPE_DESCRIPTIONS,
  ENVIRONMENT_TYPE_LABELS,
  requiresAuthorizationSource,
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

function asAssetType(value: string): AssetType {
  return (ASSET_TYPES as readonly string[]).includes(value) ? (value as AssetType) : "DOMAIN";
}

function asEnvironmentType(value: string): EnvironmentType {
  return (ENVIRONMENT_TYPES as readonly string[]).includes(value)
    ? (value as EnvironmentType)
    : "PRACTICE_LAB";
}

function FieldError({ field, state }: { field: TargetFormField; state: TargetFormState }) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`target-${field}-error`} role="alert" className="text-xs leading-relaxed text-danger">
      {message}
    </p>
  );
}

function describedBy(field: TargetFormField, state: TargetFormState, hint = false) {
  const ids: string[] = [];

  if (hint) {
    ids.push(`target-${field}-hint`);
  }

  if (state.fieldErrors?.[field]) {
    ids.push(`target-${field}-error`);
  }

  return ids.length > 0 ? ids.join(" ") : undefined;
}

export function TargetForm(props: TargetFormProps) {
  const action = props.mode === "create" ? createTargetAction : updateTargetAction;
  const [state, formAction, pending] = useActionState(action, initialValues(props.target));
  const formRef = useFormErrorFocus(state);
  const [assetType, setAssetType] = useState<AssetType>(() => asAssetType(state.values.assetType));
  const [environmentType, setEnvironmentType] = useState<EnvironmentType>(() =>
    asEnvironmentType(state.values.environmentType),
  );

  const assetGuidance = ASSET_TYPE_GUIDANCE[assetType];
  const authorizationSourceRequired =
    props.mode === "create" && requiresAuthorizationSource(environmentType);

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

      <Disclosure title="What am I registering?">
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          An asset is the website, application, API or environment you intend to research.
          Registering it helps Sentinel organize your work. You must separately define and approve
          its authorized research scope before testing.
        </p>
      </Disclosure>

      <ResearchSection
        id="form-asset"
        title="Asset"
        description={`Identify the asset and the context it runs in. Registering it here does not start testing.`}
      >
        <FieldGroup>
          <Field data-invalid={Boolean(state.fieldErrors?.name)}>
            <Label htmlFor="target-name">Asset name</Label>
            <Input
              id="target-name"
              name="name"
              required
              minLength={2}
              maxLength={100}
              autoComplete="off"
              placeholder="My Next.js Application"
              defaultValue={state.values.name}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              aria-describedby={describedBy("name", state, true)}
            />
            <FieldHint id="target-name-hint">
              Give this asset a recognisable name so you can easily identify it across your projects
              and investigations.
            </FieldHint>
            <FieldError field="name" state={state} />
          </Field>

          <ChoiceCards
            name="assetType"
            legend="Asset type"
            hintId="target-assetType-hint"
            describedBy={describedBy("assetType", state, true)}
            description="Choose the category that best matches what you are registering. It sets the expected identifier format."
            value={assetType}
            onChange={setAssetType}
            invalid={Boolean(state.fieldErrors?.assetType)}
            options={ASSET_TYPES.map((type) => ({
              value: type,
              label: ASSET_TYPE_LABELS[type],
              description: ASSET_TYPE_GUIDANCE[type].description,
              example: ASSET_TYPE_GUIDANCE[type].example,
            }))}
          />
          <FieldError field="assetType" state={state} />

          <Field data-invalid={Boolean(state.fieldErrors?.assetIdentifier)}>
            <Label htmlFor="asset-identifier">Asset identifier</Label>
            <Input
              id="asset-identifier"
              name="assetIdentifier"
              required
              maxLength={255}
              autoComplete="off"
              spellCheck={false}
              placeholder={assetGuidance.identifierPlaceholder}
              defaultValue={state.values.assetIdentifier}
              aria-invalid={Boolean(state.fieldErrors?.assetIdentifier)}
              aria-describedby={describedBy("assetIdentifier", state, true)}
            />
            <FieldHint
              id="target-assetIdentifier-hint"
              example={assetGuidance.example}
              note={assetGuidance.identifierNote}
            >
              A unique reference Sentinel uses to identify this asset within your workspace. It must
              not already be registered in this project. Use the same identifier when you define its
              scope.
            </FieldHint>
            <FieldError field="assetIdentifier" state={state} />
          </Field>

          <ChoiceCards
            name="environmentType"
            legend="Environment"
            hintId="target-environmentType-hint"
            describedBy={describedBy("environmentType", state, true)}
            description="Choose the context that best explains where the asset runs and the permission behind your research."
            value={environmentType}
            onChange={setEnvironmentType}
            invalid={Boolean(state.fieldErrors?.environmentType)}
            options={ENVIRONMENT_TYPES.map((type) => ({
              value: type,
              label: ENVIRONMENT_TYPE_LABELS[type],
              description: ENVIRONMENT_TYPE_DESCRIPTIONS[type],
            }))}
          />
          <FieldError field="environmentType" state={state} />

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
              aria-describedby={describedBy("description", state, true)}
            />
            <FieldHint
              id="target-description-hint"
              example="A local training app with login and profile pages, used to practise access-control checks."
            >
              What the asset does and what you want to find out. Note anything a reviewer should not
              touch.
            </FieldHint>
            <FieldError field="description" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <ResearchSection
        id="form-authorization-context"
        title="Authorization context"
        description="Record where your permission comes from and any conditions attached to it. This is context for your research record, not an approval step."
      >
        <FieldGroup>
          <Alert role="note">
            <AlertDescription>
              Recording this context does not grant permission on its own. Sentinel checks the
              active scope before an action. You will create and activate that scope separately
              after registering this target.
            </AlertDescription>
          </Alert>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fieldErrors?.authorizationSource)}>
              <Label htmlFor="authorization-source">Authorization source</Label>
              <Input
                id="authorization-source"
                name="authorizationSource"
                maxLength={300}
                autoComplete="off"
                list="target-authorization-source-options"
                placeholder="Bug bounty program policy"
                defaultValue={state.values.authorizationSource}
                aria-required={authorizationSourceRequired}
                aria-invalid={Boolean(state.fieldErrors?.authorizationSource)}
                aria-describedby={describedBy("authorizationSource", state, true)}
              />
              <datalist id="target-authorization-source-options">
                {AUTHORIZATION_SOURCE_SUGGESTIONS.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
              <FieldHint
                id="target-authorizationSource-hint"
                example="Bug bounty program policy, signed assessment agreement, or a lab you own."
                note={
                  authorizationSourceRequired
                    ? "Required for this environment."
                    : props.mode === "edit"
                      ? "Existing targets can be saved without changing this field. Update it when the permission changes."
                      : "Optional for a practice lab, but useful when you activate the scope later."
                }
              >
                What gives you permission to research this asset?
              </FieldHint>
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
                aria-describedby={describedBy("authorizationDate", state, true)}
              />
              <FieldHint
                id="target-authorizationDate-hint"
                example="2026-05-12"
                note="Leave blank if the permission has no formal start date."
              >
                The date the permission started or was agreed.
              </FieldHint>
              <FieldError field="authorizationDate" state={state} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field data-invalid={Boolean(state.fieldErrors?.programName)}>
              <Label htmlFor="program-name">Program or agreement name</Label>
              <Input
                id="program-name"
                name="programName"
                maxLength={120}
                autoComplete="off"
                placeholder="Acme public bug bounty"
                defaultValue={state.values.programName}
                aria-invalid={Boolean(state.fieldErrors?.programName)}
                aria-describedby={describedBy("programName", state, true)}
              />
              <FieldHint id="target-programName-hint">
                The bug bounty program, assessment or internal approval this permission belongs to,
                if it has a name.
              </FieldHint>
              <FieldError field="programName" state={state} />
            </Field>

            <Field data-invalid={Boolean(state.fieldErrors?.programUrl)}>
              <Label htmlFor="program-url">Authorization reference</Label>
              <Input
                id="program-url"
                name="programUrl"
                type="text"
                inputMode="url"
                maxLength={500}
                autoComplete="url"
                placeholder="https://example.com/security-policy"
                defaultValue={state.values.programUrl}
                aria-invalid={Boolean(state.fieldErrors?.programUrl)}
                aria-describedby={describedBy("programUrl", state, true)}
              />
              <FieldHint
                id="target-programUrl-hint"
                example="https://example.com/security-policy"
                note="If the reference is not a public link, record its document name or record ID in Authorization source."
              >
                Provide a link or reference to the policy, agreement or approval document that
                establishes your permission.
              </FieldHint>
              <FieldError field="programUrl" state={state} />
            </Field>
          </div>

          <Field data-invalid={Boolean(state.fieldErrors?.authorizationNotes)}>
            <Label htmlFor="authorization-notes">Permission notes</Label>
            <Textarea
              id="authorization-notes"
              name="authorizationNotes"
              rows={4}
              maxLength={2000}
              placeholder="No denial-of-service testing. Report critical findings within 24 hours."
              defaultValue={state.values.authorizationNotes}
              aria-invalid={Boolean(state.fieldErrors?.authorizationNotes)}
              aria-describedby={describedBy("authorizationNotes", state, true)}
            />
            <FieldHint
              id="target-authorizationNotes-hint"
              example="No denial-of-service testing; report critical issues within 24 hours."
            >
              Add any additional information about your authorization, restrictions or conditions.
            </FieldHint>
            <FieldError field="authorizationNotes" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <aside aria-labelledby="target-submit-guidance" className="border-t border-border pt-5">
        <h2 id="target-submit-guidance" className="text-sm font-medium">
          Before you register
        </h2>
        <ul className="mt-2 flex max-w-2xl list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-secondary">
          <li>Confirm the name and identifier point to the asset you intend to research.</li>
          <li>Confirm the authorization source applies to this asset and environment.</li>
          <li>
            Registering an asset records it; it does not activate a testing scope. You will draft
            and activate the scope next.
          </li>
        </ul>
      </aside>

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
