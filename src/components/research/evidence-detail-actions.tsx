"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useActionState } from "react";

import {
  deleteEvidenceAction,
  linkEvidenceAction,
  removeEvidenceLinkAction,
  reviewEvidenceAction,
  updateEvidenceMetadataAction,
} from "@/app/(dashboard)/dashboard/evidence/actions";
import {
  INITIAL_EVIDENCE_METADATA_FORM_STATE,
  INITIAL_PHASE6_STATUS_FORM_STATE,
  INITIAL_REDACTION_REVIEW_FORM_STATE,
  type EvidenceMetadataFormField,
  type EvidenceMetadataFormState,
} from "@/components/research/phase6-form-state";
import { Disclosure } from "@/components/shared/disclosure";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EVIDENCE_LINK_RELATIONSHIPS,
  EVIDENCE_LINK_RELATIONSHIP_LABELS,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  type EvidenceType,
} from "@/modules/evidence/domain/evidence";

type FindingOption = { id: string; title: string };

function StatusMessage({ status, message }: { status: string; message?: string }) {
  return status === "error" && message ? (
    <p role="alert" className="text-xs text-danger">
      {message}
    </p>
  ) : null;
}

export function EvidenceMetadataForm({
  evidenceId,
  investigationId,
  title,
  description,
  evidenceType,
  source,
}: {
  evidenceId: string;
  investigationId: string;
  title: string;
  description: string | null;
  evidenceType: EvidenceType;
  source: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateEvidenceMetadataAction, {
    ...INITIAL_EVIDENCE_METADATA_FORM_STATE,
    values: {
      title,
      description: description ?? "",
      evidenceType,
      source: source ?? "",
    },
  });
  const formRef = useFormErrorFocus(state);

  function errorFor(field: EvidenceMetadataFormField) {
    const message = (state as EvidenceMetadataFormState).fieldErrors?.[field];

    return message ? (
      <FieldError id={`${evidenceId}-metadata-${field}-error`}>{message}</FieldError>
    ) : null;
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <input type="hidden" name="investigationId" value={investigationId} />

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="evidence-metadata-title">Title</FieldLabel>
            <Input
              id="evidence-metadata-title"
              name="title"
              defaultValue={state.values.title}
              required
              aria-invalid={Boolean((state as EvidenceMetadataFormState).fieldErrors?.title)}
              aria-describedby={
                (state as EvidenceMetadataFormState).fieldErrors?.title
                  ? `${evidenceId}-metadata-title-error`
                  : undefined
              }
            />
            {errorFor("title")}
          </Field>
          <Field>
            <FieldLabel htmlFor="evidence-metadata-type">Evidence type</FieldLabel>
            <Select
              id="evidence-metadata-type"
              name="evidenceType"
              defaultValue={state.values.evidenceType}
              aria-invalid={Boolean((state as EvidenceMetadataFormState).fieldErrors?.evidenceType)}
              aria-describedby={
                (state as EvidenceMetadataFormState).fieldErrors?.evidenceType
                  ? `${evidenceId}-metadata-evidenceType-error`
                  : undefined
              }
            >
              {EVIDENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVIDENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
            {errorFor("evidenceType")}
          </Field>
          <Field>
            <FieldLabel htmlFor="evidence-metadata-source">Source</FieldLabel>
            <Input
              id="evidence-metadata-source"
              name="source"
              defaultValue={state.values.source}
              aria-invalid={Boolean((state as EvidenceMetadataFormState).fieldErrors?.source)}
              aria-describedby={
                (state as EvidenceMetadataFormState).fieldErrors?.source
                  ? `${evidenceId}-metadata-source-error`
                  : undefined
              }
            />
            {errorFor("source")}
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="evidence-metadata-description">Description</FieldLabel>
            <Textarea
              id="evidence-metadata-description"
              name="description"
              defaultValue={state.values.description}
              className="min-h-24"
              aria-invalid={Boolean((state as EvidenceMetadataFormState).fieldErrors?.description)}
              aria-describedby={
                (state as EvidenceMetadataFormState).fieldErrors?.description
                  ? `${evidenceId}-metadata-description-error`
                  : undefined
              }
            />
            {errorFor("description")}
          </Field>
        </FieldGroup>

        <StatusMessage status={state.status} message={state.message} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : "Save metadata"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RedactionReviewForm({
  evidenceId,
  investigationId,
  isReviewer,
}: {
  evidenceId: string;
  investigationId: string;
  isReviewer: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    reviewEvidenceAction,
    INITIAL_REDACTION_REVIEW_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  if (!isReviewer) {
    return (
      <p className="text-sm text-text-secondary">
        Ask a workspace owner, admin, or reviewer to complete the redaction review before using this
        evidence.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <input type="hidden" name="investigationId" value={investigationId} />

        <Field>
          <FieldLabel htmlFor="redaction-decision">Decision</FieldLabel>
          <Select id="redaction-decision" name="decision" defaultValue="APPROVE_SAFE">
            <option value="APPROVE_SAFE">Approve without change</option>
            <option value="APPROVE_REDACTED">Approve sanitized replacement</option>
            <option value="REJECT">Reject and delete quarantine</option>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="redaction-note">Review note</FieldLabel>
          <Textarea
            id="redaction-note"
            name="note"
            className="min-h-20"
            placeholder="If you're rejecting the file, explain why. Describe the sensitive information without pasting the value itself."
          />
        </Field>

        <StatusMessage status={state.status} message={state.message} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Recording…" : "Resolve redaction"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function EvidenceLinkToFindingForm({
  evidenceId,
  investigationId,
  findings,
}: {
  evidenceId: string;
  investigationId: string;
  findings: FindingOption[];
}) {
  const [state, formAction, pending] = useActionState(
    linkEvidenceAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  if (findings.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        Create a finding in this investigation first, then come back to connect the evidence.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <FieldGroup className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="link-finding">Finding</FieldLabel>
            <Select id="link-finding" name="findingId" defaultValue="">
              <option value="">Choose a finding</option>
              {findings.map((finding) => (
                <option key={finding.id} value={finding.id}>
                  {finding.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="link-finding-relationship">Relationship</FieldLabel>
            <Select id="link-finding-relationship" name="relationshipType" defaultValue="SUPPORTS">
              {EVIDENCE_LINK_RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {EVIDENCE_LINK_RELATIONSHIP_LABELS[relationship]}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGroup>
        <StatusMessage status={state.status} message={state.message} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Linking…" : "Link to finding"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RemoveEvidenceFindingLinkButton({
  linkId,
  evidenceId,
  investigationId,
}: {
  linkId: string;
  evidenceId: string;
  investigationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeEvidenceLinkAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-busy={pending}
      className="inline-flex flex-col items-start gap-1"
    >
      <FieldGroup>
        <input type="hidden" name="linkId" value={linkId} />
        <input type="hidden" name="evidenceId" value={evidenceId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <Button className="self-start" type="submit" variant="ghost" size="xs" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          Remove link
        </Button>
        <StatusMessage status={state.status} message={state.message} />
      </FieldGroup>
    </form>
  );
}

export function DeleteEvidenceForm({
  evidenceId,
  investigationId,
}: {
  evidenceId: string;
  investigationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteEvidenceAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  return (
    <Disclosure title="Delete evidence">
      <Alert variant="warning">
        <AlertDescription>
          This deletes the stored file. Remove its finding links first and check that you no longer
          need it. You can&apos;t undo deletion from the workspace.
        </AlertDescription>
      </Alert>
      <form ref={formRef} action={formAction} aria-busy={pending} className="mt-5">
        <FieldGroup>
          <input type="hidden" name="evidenceId" value={evidenceId} />
          <input type="hidden" name="investigationId" value={investigationId} />
          <Button
            className="self-start"
            type="submit"
            variant="destructive"
            size="sm"
            disabled={pending}
          >
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Deleting…" : "Confirm deletion"}
          </Button>
          <StatusMessage status={state.status} message={state.message} />
        </FieldGroup>
      </form>
    </Disclosure>
  );
}
