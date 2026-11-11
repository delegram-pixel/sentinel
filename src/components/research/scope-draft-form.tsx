"use client";

import { FieldHelpLabel } from "@/components/shared/field-help-label";

import { FieldHint } from "@/components/shared/field-hint";
import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";

import { createScopeDraftAction } from "@/app/(dashboard)/dashboard/projects/[projectId]/targets/[targetId]/scopes/actions";
import {
  INITIAL_SCOPE_DRAFT_STATE,
  type ScopeDraftField,
  type ScopeDraftFormState,
} from "@/components/research/scope-form-state";
import { Field, FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  CAPABILITY_POLICY,
} from "@/modules/security/domain/capability";
import {
  SCOPE_ASSET_EFFECTS,
  SCOPE_ASSET_EFFECT_LABELS,
  SCOPE_ASSET_MATCH_LABELS,
  SCOPE_ASSET_MATCH_TYPES,
} from "@/modules/research/domain/scope";
import { ASSET_TYPES, ASSET_TYPE_LABELS, type AssetType } from "@/modules/research/domain/target";

type AssetRow = {
  id: number;
  assetIdentifier: string;
  assetType: AssetType;
  matchType: string;
  effect: string;
  notes: string;
};

type ScopeDraftFormProps = {
  projectId: string;
  targetId: string;
  targetName: string;
  defaultAssetIdentifier: string;
  defaultAssetType: AssetType;
};

function initialRows(assetIdentifier: string, assetType: AssetType): AssetRow[] {
  return [
    {
      id: 1,
      assetIdentifier,
      assetType,
      matchType: assetType === "DOMAIN" ? "DOMAIN" : "EXACT",
      effect: "ALLOWED",
      notes: "",
    },
  ];
}

function FieldError({ field, state }: { field: ScopeDraftField; state: ScopeDraftFormState }) {
  const message = state.fieldErrors?.[field];

  if (!message) {
    return null;
  }

  return (
    <p id={`scope-${field}-error`} className="text-xs text-danger">
      {message}
    </p>
  );
}

export function ScopeDraftForm({
  projectId,
  targetId,
  targetName,
  defaultAssetIdentifier,
  defaultAssetType,
}: ScopeDraftFormProps) {
  const [state, formAction, pending] = useActionState(
    createScopeDraftAction,
    INITIAL_SCOPE_DRAFT_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const [rows, setRows] = useState<AssetRow[]>(() =>
    initialRows(defaultAssetIdentifier, defaultAssetType),
  );
  const nextId = useRef(2);

  function updateRow(id: number, patch: Partial<AssetRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const id = nextId.current;
    nextId.current += 1;
    setRows((current) => [
      ...current,
      {
        id,
        assetIdentifier: "",
        assetType: "DOMAIN",
        matchType: "DOMAIN",
        effect: "ALLOWED",
        notes: "",
      },
    ]);
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : current));
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="targetId" value={targetId} />

      {state.status === "error" && state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <ResearchSection
        id="form-effective-window"
        title="Effective window"
        help={{
          description:
            "Set when the permission starts and ends. The scope must be active and within these dates before it can allow an action.",
          example:
            "Copy the dates and times from your agreement, then double-check them before activation.",
          note: "Saving creates a draft. You'll need to review and activate it before testing.",
        }}
        description={
          <>After activation, this scope only allows actions during the dates you set here.</>
        }
      >
        <FieldGroup className="grid sm:grid-cols-2">
          <Field data-invalid={Boolean(state.fieldErrors?.effectiveFrom)}>
            <Label htmlFor="effective-from">Effective from</Label>
            <Input
              id="effective-from"
              name="effectiveFrom"
              type="date"
              required
              aria-invalid={Boolean(state.fieldErrors?.effectiveFrom)}
              aria-describedby={
                state.fieldErrors?.effectiveFrom
                  ? "scope-effectiveFrom-error scope-effectiveFrom-hint"
                  : "scope-effectiveFrom-hint"
              }
            />
            <FieldHint
              id="scope-effectiveFrom-hint"
              example="2026-05-12"
              note="The scope cannot allow an action before this date."
            >
              The first date the permission applies.
            </FieldHint>
            <FieldError field="effectiveFrom" state={state} />
          </Field>
          <Field data-invalid={Boolean(state.fieldErrors?.effectiveUntil)}>
            <Label htmlFor="effective-until">Effective until</Label>
            <Input
              id="effective-until"
              name="effectiveUntil"
              type="date"
              required
              aria-invalid={Boolean(state.fieldErrors?.effectiveUntil)}
              aria-describedby={
                state.fieldErrors?.effectiveUntil
                  ? "scope-effectiveUntil-error scope-effectiveUntil-hint"
                  : "scope-effectiveUntil-hint"
              }
            />
            <FieldHint
              id="scope-effectiveUntil-hint"
              example="2026-06-12"
              note="Choose an end date you can justify from the permission."
            >
              The last date the permission applies.
            </FieldHint>
            <FieldError field="effectiveUntil" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <ResearchSection
        id="form-assets"
        title="Assets"
        description={
          <>Add at least one allowed asset. List exclusions too, so the boundaries are clear.</>
        }
        action={
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus data-icon="inline-start" aria-hidden />
            Add asset
          </Button>
        }
      >
        <FieldGroup>
          {rows.map((row, index) => (
            <FieldSet key={row.id} className="border-t border-border py-5">
              <FieldLegend className="text-sm font-medium">Asset {index + 1}</FieldLegend>

              <Field>
                <Label htmlFor={`asset-identifier-${row.id}`}>Asset identifier</Label>
                <Input
                  id={`asset-identifier-${row.id}`}
                  name="assetIdentifier"
                  required
                  maxLength={255}
                  autoComplete="off"
                  spellCheck={false}
                  value={row.assetIdentifier}
                  onChange={(event) => updateRow(row.id, { assetIdentifier: event.target.value })}
                  aria-describedby={`asset-identifier-${row.id}-hint`}
                />
                <FieldHint
                  id={`asset-identifier-${row.id}-hint`}
                  example="app.example.test or https://app.example.test/login"
                >
                  The asset this rule covers. Use the identifier you registered for the target, or a
                  specific part of it.
                </FieldHint>
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field>
                  <Label htmlFor={`asset-type-${row.id}`}>Asset type</Label>
                  <Select
                    id={`asset-type-${row.id}`}
                    name="assetType"
                    value={row.assetType}
                    onChange={(event) =>
                      updateRow(row.id, { assetType: event.target.value as AssetType })
                    }
                    aria-describedby={`asset-type-${row.id}-hint`}
                  >
                    {ASSET_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ASSET_TYPE_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                  <FieldHint
                    id={`asset-type-${row.id}-hint`}
                    example="Domain for app.example.test."
                  >
                    The format of the identifier above. It controls how the asset is validated.
                  </FieldHint>
                </Field>

                <Field>
                  <FieldHelpLabel
                    htmlFor={`match-type-${row.id}`}
                    help={{
                      description:
                        "Choose how the rule matches an asset. Exact matches one identifier; broader patterns may include additional assets, so check the boundaries carefully.",
                      example:
                        "Use Exact for one specific URL. Use a domain rule only if your permission covers that domain.",
                      note: "Check what the rule will match before activation. It must stay within the permission you've been given.",
                    }}
                  >
                    Match type
                  </FieldHelpLabel>
                  <Select
                    id={`match-type-${row.id}`}
                    name="matchType"
                    value={row.matchType}
                    onChange={(event) => updateRow(row.id, { matchType: event.target.value })}
                    aria-describedby={`match-type-${row.id}-hint`}
                  >
                    {SCOPE_ASSET_MATCH_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {SCOPE_ASSET_MATCH_LABELS[type]}
                      </option>
                    ))}
                  </Select>
                  <FieldHint
                    id={`match-type-${row.id}-hint`}
                    example="Use Exact for one specific URL. Use a domain rule only if your permission covers that domain."
                  >
                    How the rule compares an asset to the identifier. Broader patterns can include
                    more assets, so check the boundaries.
                  </FieldHint>
                </Field>

                <Field>
                  <FieldHelpLabel
                    htmlFor={`effect-${row.id}`}
                    help={{
                      description:
                        "Choose whether this rule allows or excludes an asset. If both rules match, the exclusion wins.",
                      example:
                        "Allow the assessment domain, then exclude any third-party asset your agreement doesn't cover.",
                    }}
                  >
                    Effect
                  </FieldHelpLabel>
                  <Select
                    id={`effect-${row.id}`}
                    name="effect"
                    value={row.effect}
                    onChange={(event) => updateRow(row.id, { effect: event.target.value })}
                    aria-describedby={`effect-${row.id}-hint`}
                  >
                    {SCOPE_ASSET_EFFECTS.map((effect) => (
                      <option key={effect} value={effect}>
                        {SCOPE_ASSET_EFFECT_LABELS[effect]}
                      </option>
                    ))}
                  </Select>
                  <FieldHint
                    id={`effect-${row.id}-hint`}
                    example="Allow the assessment domain, then exclude any third-party asset your agreement doesn't cover."
                    note="If an allow rule and an exclusion both match, the exclusion wins."
                  >
                    Whether this rule allows or excludes the asset.
                  </FieldHint>
                </Field>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Field className="flex-1">
                  <Label htmlFor={`asset-notes-${row.id}`}>Asset notes</Label>
                  <Input
                    id={`asset-notes-${row.id}`}
                    name="assetNotes"
                    maxLength={500}
                    autoComplete="off"
                    value={row.notes}
                    onChange={(event) => updateRow(row.id, { notes: event.target.value })}
                    aria-describedby={`asset-notes-${row.id}-hint`}
                  />
                  <FieldHint
                    id={`asset-notes-${row.id}-hint`}
                    example="Third-party payment page is out of scope."
                  >
                    Why this asset is included or excluded. This is for the reviewer and does not
                    change what the rule matches.
                  </FieldHint>
                </Field>
                {rows.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove asset ${index + 1}`}
                    onClick={() => removeRow(row.id)}
                  >
                    <Trash2 data-icon="inline-start" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </FieldSet>
          ))}
          <FieldError field="assets" state={state} />
        </FieldGroup>
      </ResearchSection>

      <ResearchSection
        id="form-permitted-activities"
        title="Permitted activities"
        help={{
          description:
            "Select only the actions your permission covers. An action needs explicit permission here; the target name, project type, or engagement status can't supply it.",
          example:
            "Read each action's description before selecting it. For example, permit reading saved research context if your authorization covers it.",
          note: "A scope only permits actions the app supports. It doesn't add new tools or enable autonomous testing.",
        }}
        description={`Choose the actions your permission covers for ${targetName}. The app checks these permissions whenever an action runs.`}
      >
        <FieldGroup>
          {CAPABILITIES.map((capability) => {
            const policy = CAPABILITY_POLICY[capability];
            const unavailable =
              policy.status === "PROHIBITED" || policy.status === "NOT_IMPLEMENTED";

            return (
              <div key={capability} className="flex items-start gap-3">
                <input
                  id={`activity-${capability}`}
                  type="checkbox"
                  name="permittedActivities"
                  value={capability}
                  className="mt-1 size-4 rounded border-input accent-primary"
                />
                <div className="min-w-0">
                  <Label htmlFor={`activity-${capability}`} className="font-normal">
                    {CAPABILITY_LABELS[capability]}
                  </Label>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {policy.description}
                    {unavailable
                      ? ` Currently ${policy.status.toLowerCase().replaceAll("_", " ")}.`
                      : ""}
                  </p>
                </div>
              </div>
            );
          })}
          <FieldError field="permittedActivities" state={state} />
        </FieldGroup>
      </ResearchSection>

      <ResearchSection
        id="form-draft-notes"
        title="Draft notes"
        description={
          <>
            Add any background the reviewer should know. You&apos;ll confirm the permission
            separately when activating this scope.
          </>
        }
      >
        <FieldGroup>
          <Field data-invalid={Boolean(state.fieldErrors?.attestationNotes)}>
            <Label htmlFor="scope-draft-notes" className="sr-only">
              Draft notes
            </Label>
            <Textarea
              id="scope-draft-notes"
              name="attestationNotes"
              rows={4}
              maxLength={2000}
              placeholder="Why this window, these assets, and these activities?"
              aria-invalid={Boolean(state.fieldErrors?.attestationNotes)}
              aria-describedby={
                state.fieldErrors?.attestationNotes
                  ? "scope-attestationNotes-error scope-attestationNotes-hint"
                  : "scope-attestationNotes-hint"
              }
            />
            <FieldHint
              id="scope-attestationNotes-hint"
              example="Short maintenance window agreed with the app owner."
            >
              Background for the reviewer: why this window, these assets, and these activities.
            </FieldHint>
            <FieldError field="attestationNotes" state={state} />
          </Field>
        </FieldGroup>
      </ResearchSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving draft…" : "Save draft"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/dashboard/projects/${projectId}/targets/${targetId}`}>Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
