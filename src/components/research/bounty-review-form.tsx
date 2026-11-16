"use client";

import { useState, useTransition, useRef } from "react";
import { LoaderCircle, Plus, Trash2 } from "lucide-react";
import { saveBountyProjectAction } from "@/app/(dashboard)/dashboard/projects/bounty-actions";
import { bountyReviewSchema, type BountyDraft } from "@/modules/bounty/domain/bounty-import";
import { ASSET_TYPES, ASSET_TYPE_LABELS } from "@/modules/research/domain/target";
import {
  SCOPE_ASSET_MATCH_TYPES,
  SCOPE_ASSET_MATCH_LABELS,
  SCOPE_ASSET_EFFECTS,
  SCOPE_ASSET_EFFECT_LABELS,
} from "@/modules/research/domain/scope";
import {
  CAPABILITIES,
  CAPABILITY_POLICY,
  CAPABILITY_LABELS,
} from "@/modules/security/domain/capability";
import { ResearchSection } from "@/components/shared/research-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldSet, FieldLegend } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export function BountyReviewForm({
  draft,
  importJobId,
}: {
  draft: BountyDraft;
  importJobId: string;
}) {
  const [assets, setAssets] = useState(() =>
    draft.assets.map((asset) => ({ ...asset, rowId: crypto.randomUUID() })),
  );
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [pending, startTransition] = useTransition();
  const operationKey = useRef(crypto.randomUUID());
  const errorRef = useRef<HTMLDivElement>(null);
  function update(rowId: string, patch: Partial<BountyDraft["assets"][number]>) {
    setAssets((current) =>
      current.map((asset) => (asset.rowId === rowId ? { ...asset, ...patch } : asset)),
    );
  }

  return (
    <form
      className="form-stack"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const text = (key: string) => String(data.get(key) ?? "");
        const parsed = bountyReviewSchema.safeParse({
          importJobId,
          operationKey: operationKey.current,
          project: {
            name: text("name"),
            description: text("description"),
            projectType: "BUG_BOUNTY",
          },
          programName: text("programName"),
          programUrl: text("programUrl"),
          authorizationSource: text("authorizationSource"),
          authorizationNotes: text("authorizationNotes"),
          effectiveFrom: text("effectiveFrom"),
          effectiveUntil: text("effectiveUntil"),
          permittedActivities: data.getAll("permittedActivities"),
          assets,
          acknowledged: data.get("acknowledged") === "on",
        });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the highlighted details.");
          const path = parsed.error.issues[0]?.path ?? [];
          const field =
            path[0] === "project"
              ? path[1]
              : path[0] === "assets"
                ? `asset-${String(path[1])}-${String(path[2])}`
                : path[0];
          setInvalidField(typeof field === "string" ? field : "");
          const control =
            typeof field === "string"
              ? form.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`)
              : null;
          if (control instanceof HTMLElement) control.focus();
          return;
        }
        setError("");
        setInvalidField("");
        startTransition(async () => {
          try {
            const result = await saveBountyProjectAction(parsed.data);
            if (result) setError(result.message);
          } catch {
            setError("Could not save the project. Your changes are still here; try again.");
          }
        });
      }}
    >
      {draft.warnings.length ? (
        <Alert variant="warning" role="note">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {draft.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {draft.sourceUrl ? (
        <p className="text-sm text-muted-foreground">
          Read from{" "}
          <a
            href={draft.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="record-link break-all"
          >
            {draft.sourceUrl}
          </a>
        </p>
      ) : null}
      <fieldset disabled={pending} className="form-stack min-w-0">
        <ResearchSection
          id="bounty-project-details"
          title="Project and program"
          description="Check the suggested names and summary before creating your bug bounty project."
        >
          <FieldGroup>
            <Field data-invalid={invalidField === "name"}>
              <Label htmlFor="import-project-name">Project name</Label>
              <Input
                id="import-project-name"
                name="name"
                aria-invalid={invalidField === "name"}
                defaultValue={draft.name}
                required
                minLength={2}
                maxLength={80}
              />
            </Field>
            <Field>
              <Label htmlFor="import-program-name">Program name</Label>
              <Input
                id="import-program-name"
                name="programName"
                defaultValue={draft.programName}
                maxLength={120}
              />
            </Field>
            <Field>
              <Label htmlFor="import-program-url">Program URL</Label>
              <Input
                id="import-program-url"
                name="programUrl"
                type="url"
                defaultValue={draft.programUrl}
                maxLength={500}
              />
            </Field>
            <Field>
              <Label htmlFor="import-description">Description</Label>
              <Textarea
                id="import-description"
                name="description"
                defaultValue={draft.description}
                rows={4}
                maxLength={2000}
              />
            </Field>
            <Field data-invalid={invalidField === "authorizationSource"}>
              <Label htmlFor="import-authorization-source">Authorization source</Label>
              <Input
                id="import-authorization-source"
                name="authorizationSource"
                aria-invalid={invalidField === "authorizationSource"}
                defaultValue={draft.programUrl.slice(0, 300)}
                required
                minLength={3}
                maxLength={300}
                placeholder="Program policy URL or written permission"
              />
            </Field>
          </FieldGroup>
        </ResearchSection>
        <ResearchSection
          id="bounty-assets"
          title="Targets and scope"
          description="Each allowed asset becomes a target with a draft scope. Excluded assets are retained in every scope. Exact matching keeps a named host separate from its subdomains."
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={assets.length >= 50 || pending}
              onClick={() =>
                setAssets((current) => [
                  ...current,
                  {
                    rowId: crypto.randomUUID(),
                    assetIdentifier: "",
                    assetType: "DOMAIN",
                    matchType: "EXACT",
                    effect: "ALLOWED",
                    notes: "",
                    sourceQuote: "Added during human review.",
                  },
                ])
              }
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add asset
            </Button>
          }
        >
          <FieldGroup>
            {assets.map((asset, index) => (
              <FieldSet key={asset.rowId}>
                <FieldLegend>Asset {index + 1}</FieldLegend>
                <FieldGroup>
                  <Field data-invalid={invalidField === `asset-${index}-assetIdentifier`}>
                    <Label htmlFor={`import-asset-${asset.rowId}`}>Asset identifier</Label>
                    <Input
                      id={`import-asset-${asset.rowId}`}
                      name={`asset-${index}-assetIdentifier`}
                      aria-invalid={invalidField === `asset-${index}-assetIdentifier`}
                      value={asset.assetIdentifier}
                      onChange={(event) =>
                        update(asset.rowId, { assetIdentifier: event.target.value })
                      }
                      required
                      maxLength={255}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <FieldGroup className="grid sm:grid-cols-3">
                    <Field>
                      <Label htmlFor={`import-type-${asset.rowId}`}>Asset type</Label>
                      <Select
                        id={`import-type-${asset.rowId}`}
                        value={asset.assetType}
                        onChange={(event) =>
                          update(asset.rowId, {
                            assetType: event.target.value as typeof asset.assetType,
                          })
                        }
                      >
                        {ASSET_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {ASSET_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field data-invalid={invalidField === `asset-${index}-matchType`}>
                      <Label htmlFor={`import-match-${asset.rowId}`}>Match type</Label>
                      <Select
                        id={`import-match-${asset.rowId}`}
                        name={`asset-${index}-matchType`}
                        aria-invalid={invalidField === `asset-${index}-matchType`}
                        value={asset.matchType}
                        onChange={(event) =>
                          update(asset.rowId, {
                            matchType: event.target.value as typeof asset.matchType,
                          })
                        }
                      >
                        {SCOPE_ASSET_MATCH_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {SCOPE_ASSET_MATCH_LABELS[type]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field>
                      <Label htmlFor={`import-effect-${asset.rowId}`}>Effect</Label>
                      <Select
                        id={`import-effect-${asset.rowId}`}
                        value={asset.effect}
                        onChange={(event) =>
                          update(asset.rowId, { effect: event.target.value as typeof asset.effect })
                        }
                      >
                        {SCOPE_ASSET_EFFECTS.map((effect) => (
                          <option key={effect} value={effect}>
                            {SCOPE_ASSET_EFFECT_LABELS[effect]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </FieldGroup>
                  <Field>
                    <Label htmlFor={`import-notes-${asset.rowId}`}>Asset notes</Label>
                    <Textarea
                      id={`import-notes-${asset.rowId}`}
                      value={asset.notes}
                      onChange={(event) => update(asset.rowId, { notes: event.target.value })}
                      rows={2}
                      maxLength={500}
                    />
                  </Field>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">
                    Source: {asset.sourceQuote}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAssets((current) => current.filter((row) => row.rowId !== asset.rowId))
                    }
                  >
                    <Trash2 data-icon="inline-start" aria-hidden />
                    Remove asset {index + 1}
                  </Button>
                </FieldGroup>
              </FieldSet>
            ))}
          </FieldGroup>
        </ResearchSection>
        <ResearchSection
          id="bounty-permission-window"
          title="Scope dates and restrictions"
          description="Leave dates blank when the policy does not specify them. The saved scopes stay drafts until you complete and activate them."
        >
          <FieldGroup>
            <FieldGroup className="grid sm:grid-cols-2">
              <Field data-invalid={invalidField === "effectiveFrom"}>
                <Label htmlFor="import-effective-from">Effective from</Label>
                <Input
                  id="import-effective-from"
                  name="effectiveFrom"
                  aria-invalid={invalidField === "effectiveFrom"}
                  type="date"
                  defaultValue={draft.effectiveFrom ?? ""}
                />
              </Field>
              <Field data-invalid={invalidField === "effectiveUntil"}>
                <Label htmlFor="import-effective-until">Effective until</Label>
                <Input
                  id="import-effective-until"
                  name="effectiveUntil"
                  aria-invalid={invalidField === "effectiveUntil"}
                  type="date"
                  defaultValue={draft.effectiveUntil ?? ""}
                />
              </Field>
            </FieldGroup>
            <Field>
              <Label htmlFor="import-restrictions">Authorization and scope notes</Label>
              <Textarea
                id="import-restrictions"
                name="authorizationNotes"
                defaultValue={draft.authorizationNotes}
                rows={5}
                maxLength={2000}
              />
            </Field>
            <FieldSet>
              <FieldLegend>Permitted Sentinel activities</FieldLegend>
              <p className="text-xs text-muted-foreground">
                Choose activities covered by your permission. Activation requires a separate
                attestation.
              </p>
              <FieldGroup>
                {CAPABILITIES.filter(
                  (capability) => CAPABILITY_POLICY[capability].status === "ENABLED",
                ).map((capability) => (
                  <Field key={capability} orientation="horizontal">
                    <input
                      id={`import-activity-${capability}`}
                      type="checkbox"
                      name="permittedActivities"
                      value={capability}
                      className="size-4 accent-primary"
                    />
                    <Label htmlFor={`import-activity-${capability}`} className="font-normal">
                      {CAPABILITY_LABELS[capability]}
                    </Label>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </ResearchSection>
        <Field orientation="horizontal">
          <input
            id="import-reviewed"
            type="checkbox"
            name="acknowledged"
            required
            className="size-4 accent-primary"
          />
          <Label htmlFor="import-reviewed" className="font-normal">
            I reviewed the imported fields, assets, exclusions, and restrictions.
          </Label>
        </Field>
      </fieldset>
      {error ? (
        <Alert ref={errorRef} tabIndex={-1} variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? (
          <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
        ) : null}
        {pending ? "Creating project…" : "Create project and scope drafts"}
      </Button>
    </form>
  );
}
