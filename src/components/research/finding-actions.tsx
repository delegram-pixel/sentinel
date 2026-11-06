"use client";

import { useFormErrorFocus } from "@/components/shared/use-form-error-focus";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useActionState } from "react";

import {
  assessSeverityAction,
  changeFindingStatusAction,
  confirmDuplicateAction,
  linkEvidenceAction,
  removeFindingEvidenceLinkAction,
  reviewFindingAction,
} from "@/app/(dashboard)/dashboard/findings/actions";
import {
  INITIAL_PHASE6_STATUS_FORM_STATE,
  INITIAL_REVIEW_FORM_STATE,
  INITIAL_SEVERITY_FORM_STATE,
  type Phase6StatusFormState,
  type ReviewFormField,
  type SeverityFormField,
} from "@/components/research/phase6-form-state";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovedEvidenceRow, DuplicateCandidate } from "@/modules/findings/application/ports";
import {
  FINDING_STATUS_LABELS,
  RESOLUTION_REASONS,
  RESOLUTION_REASON_LABELS,
  SEVERITIES,
  SEVERITY_LABELS,
  type Severity,
} from "@/modules/findings/domain/finding";
import { canTransitionFinding, type FindingStatus } from "@/modules/findings/domain/finding-status";
import {
  EVIDENCE_LINK_RELATIONSHIPS,
  EVIDENCE_LINK_RELATIONSHIP_LABELS,
} from "@/modules/evidence/domain/evidence";
import { ASSET_TYPES } from "@/modules/research/domain/target";
import {
  HUMAN_VERIFICATION_CONCLUSIONS,
  VERIFICATION_CONCLUSION_LABELS,
} from "@/modules/verification/domain/verification-conclusion";

function Message({ state }: { state: Phase6StatusFormState }) {
  return state.status === "error" && state.message ? (
    <p role="alert" className="text-xs text-danger">
      {state.message}
    </p>
  ) : null;
}

const HUMAN_REVIEW_ONLY: readonly FindingStatus[] = ["CONFIRMED", "FALSE_POSITIVE", "REJECTED"];

export function FindingStatusForm({
  findingId,
  investigationId,
  currentStatus,
  isReviewer,
}: {
  findingId: string;
  investigationId: string;
  currentStatus: FindingStatus;
  isReviewer: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    changeFindingStatusAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);
  const statuses = (
    [
      "DRAFT",
      "NEEDS_VALIDATION",
      "UNDER_REVIEW",
      "CONFIRMED",
      "FALSE_POSITIVE",
      "REJECTED",
      "REPORTABLE",
      "CLOSED",
    ] as const
  ).filter((status) => {
    if (HUMAN_REVIEW_ONLY.includes(status)) {
      return false;
    }

    if (status === "REPORTABLE" && !isReviewer) {
      return false;
    }

    return canTransitionFinding(
      currentStatus,
      status,
      status === "REPORTABLE" ? "REVIEWER" : "RESEARCHER",
    );
  });

  if (statuses.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        {currentStatus === "UNDER_REVIEW"
          ? "Record a human verification review to confirm, reject, or close this finding."
          : "No direct status transition is available from the current state."}
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <div className="flex flex-wrap items-end gap-3">
          <Field className="min-w-48 flex-1">
            <FieldLabel htmlFor="finding-status">Move to status</FieldLabel>
            <Select id="finding-status" name="status" defaultValue={statuses[0]}>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {FINDING_STATUS_LABELS[status]}
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
        <Message state={state} />
      </FieldGroup>
    </form>
  );
}

export function SeverityAssessmentForm({
  findingId,
  investigationId,
  severity,
  severityRationale,
  affectedAsset,
  affectedAssetType,
}: {
  findingId: string;
  investigationId: string;
  severity: Severity;
  severityRationale: string | null;
  affectedAsset: string | null;
  affectedAssetType: string | null;
}) {
  const [state, formAction, pending] = useActionState(assessSeverityAction, {
    ...INITIAL_SEVERITY_FORM_STATE,
    values: {
      severity,
      severityRationale: severityRationale ?? "",
      affectedAsset: affectedAsset ?? "",
      affectedAssetType: affectedAssetType ?? "",
    },
  });
  const formRef = useFormErrorFocus(state);

  function errorFor(field: SeverityFormField) {
    const message = state.fieldErrors?.[field];

    return message ? (
      <FieldError id={`${findingId}-assessment-${field}-error`}>{message}</FieldError>
    ) : null;
  }

  function errorAttributes(field: SeverityFormField) {
    return {
      "aria-invalid": Boolean(state.fieldErrors?.[field]),
      "aria-describedby": state.fieldErrors?.[field]
        ? `${findingId}-assessment-${field}-error`
        : undefined,
    };
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="finding-severity">Severity</FieldLabel>
            <Select
              id="finding-severity"
              name="severity"
              defaultValue={state.values.severity}
              {...errorAttributes("severity")}
            >
              {SEVERITIES.map((value) => (
                <option key={value} value={value}>
                  {SEVERITY_LABELS[value]}
                </option>
              ))}
            </Select>
            {errorFor("severity")}
          </Field>

          <Field>
            <FieldLabel htmlFor="finding-severity-asset-type">Affected asset type</FieldLabel>
            <Select
              id="finding-severity-asset-type"
              name="affectedAssetType"
              defaultValue={state.values.affectedAssetType}
              {...errorAttributes("affectedAssetType")}
            >
              <option value="">Not set</option>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replaceAll("_", " ").toLowerCase()}
                </option>
              ))}
            </Select>
            {errorFor("affectedAssetType")}
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="finding-severity-asset">Affected asset</FieldLabel>
            <Input
              id="finding-severity-asset"
              name="affectedAsset"
              defaultValue={state.values.affectedAsset}
              {...errorAttributes("affectedAsset")}
              placeholder="Specific endpoint, host, feature, or component"
            />
            {errorFor("affectedAsset")}
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="finding-severity-rationale">Severity rationale</FieldLabel>
            <Textarea
              id="finding-severity-rationale"
              name="severityRationale"
              defaultValue={state.values.severityRationale}
              {...errorAttributes("severityRationale")}
              className="min-h-24"
              placeholder="Why this severity, based on impact and exploitability."
            />
            {errorFor("severityRationale")}
          </Field>
        </FieldGroup>

        <Message state={{ status: state.status, message: state.message }} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Saving…" : "Record assessment"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function VerificationReviewForm({
  findingId,
  investigationId,
}: {
  findingId: string;
  investigationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    reviewFindingAction,
    INITIAL_REVIEW_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  function errorFor(field: ReviewFormField) {
    const message = state.fieldErrors?.[field];
    return message ? (
      <FieldError id={`${findingId}-review-${field}-error`}>{message}</FieldError>
    ) : null;
  }

  function errorAttributes(field: ReviewFormField) {
    return {
      "aria-invalid": Boolean(state.fieldErrors?.[field]),
      "aria-describedby": state.fieldErrors?.[field]
        ? `${findingId}-review-${field}-error`
        : undefined,
    };
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />

        <FieldGroup className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="review-conclusion">Human conclusion</FieldLabel>
            <Select
              id="review-conclusion"
              name="conclusion"
              defaultValue={state.values.conclusion}
              {...errorAttributes("conclusion")}
            >
              {HUMAN_VERIFICATION_CONCLUSIONS.map((conclusion) => (
                <option key={conclusion} value={conclusion}>
                  {VERIFICATION_CONCLUSION_LABELS[conclusion]}
                </option>
              ))}
            </Select>
            {errorFor("conclusion")}
          </Field>

          <Field>
            <FieldLabel htmlFor="review-resolution">Resolution reason</FieldLabel>
            <Select
              id="review-resolution"
              name="resolutionReason"
              defaultValue={state.values.resolutionReason}
              {...errorAttributes("resolutionReason")}
            >
              <option value="">Not required</option>
              {RESOLUTION_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {RESOLUTION_REASON_LABELS[reason]}
                </option>
              ))}
            </Select>
            {errorFor("resolutionReason")}
          </Field>

          <Field>
            <FieldLabel htmlFor="review-supporting">Supporting evidence</FieldLabel>
            <Textarea
              id="review-supporting"
              name="supportingEvidence"
              defaultValue={state.values.supportingEvidence}
              {...errorAttributes("supportingEvidence")}
              className="min-h-20"
              placeholder="One reference per line"
            />
            {errorFor("supportingEvidence")}
          </Field>

          <Field>
            <FieldLabel htmlFor="review-contradicting">Contradicting evidence</FieldLabel>
            <Textarea
              id="review-contradicting"
              name="contradictingEvidence"
              defaultValue={state.values.contradictingEvidence}
              {...errorAttributes("contradictingEvidence")}
              className="min-h-20"
              placeholder="One reference per line"
            />
            {errorFor("contradictingEvidence")}
          </Field>

          <Field>
            <FieldLabel htmlFor="review-missing">Missing evidence</FieldLabel>
            <Textarea
              id="review-missing"
              name="missingEvidence"
              defaultValue={state.values.missingEvidence}
              {...errorAttributes("missingEvidence")}
              className="min-h-20"
              placeholder="One item per line"
            />
            {errorFor("missingEvidence")}
          </Field>

          <Field>
            <FieldLabel htmlFor="review-impact">Impact assessment</FieldLabel>
            <Textarea
              id="review-impact"
              name="impactAssessment"
              defaultValue={state.values.impactAssessment}
              {...errorAttributes("impactAssessment")}
              className="min-h-20"
            />
            {errorFor("impactAssessment")}
          </Field>

          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="review-reasoning">Reasoning summary</FieldLabel>
            <Textarea
              id="review-reasoning"
              name="reasoningSummary"
              defaultValue={state.values.reasoningSummary}
              {...errorAttributes("reasoningSummary")}
              className="min-h-24"
            />
            {errorFor("reasoningSummary")}
          </Field>
        </FieldGroup>

        <Message state={{ status: state.status, message: state.message }} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Recording…" : "Record human review"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function DuplicateConfirmationForm({
  findingId,
  investigationId,
  candidates,
}: {
  findingId: string;
  investigationId: string;
  candidates: DuplicateCandidate[];
}) {
  const [state, formAction, pending] = useActionState(
    confirmDuplicateAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No similar findings were detected in this investigation. Duplicate detection is advisory; a
        reviewer still makes the final call.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <Field>
          <FieldLabel htmlFor="duplicate-canonical">Canonical finding</FieldLabel>
          <Select id="duplicate-canonical" name="canonicalFindingId" defaultValue="">
            <option value="">Choose a finding</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title} ({(candidate.similarity * 100).toFixed(0)}% similar)
              </option>
            ))}
          </Select>
        </Field>
        <Message state={state} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Confirming…" : "Confirm duplicate"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function EvidenceLinkForm({
  findingId,
  investigationId,
  evidence,
}: {
  findingId: string;
  investigationId: string;
  evidence: ApprovedEvidenceRow[];
}) {
  const [state, formAction, pending] = useActionState(
    linkEvidenceAction,
    INITIAL_PHASE6_STATUS_FORM_STATE,
  );
  const formRef = useFormErrorFocus(state);

  if (evidence.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No approved evidence is available yet. Upload evidence and have a reviewer resolve redaction
        first.
      </p>
    );
  }

  return (
    <form ref={formRef} action={formAction} aria-busy={pending} className="form-stack">
      <FieldGroup>
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <FieldGroup className="grid gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="link-evidence">Approved evidence</FieldLabel>
            <Select id="link-evidence" name="evidenceId" defaultValue="">
              <option value="">Choose evidence</option>
              {evidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="link-relationship">Relationship</FieldLabel>
            <Select id="link-relationship" name="relationshipType" defaultValue="SUPPORTS">
              {EVIDENCE_LINK_RELATIONSHIPS.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {EVIDENCE_LINK_RELATIONSHIP_LABELS[relationship]}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGroup>
        <Message state={state} />
        <Button className="self-start" type="submit" variant="outline" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : null}
          {pending ? "Linking…" : "Link evidence"}
        </Button>
      </FieldGroup>
    </form>
  );
}

export function RemoveEvidenceLinkButton({
  linkId,
  findingId,
  investigationId,
}: {
  linkId: string;
  findingId: string;
  investigationId: string;
}) {
  const [state, formAction, pending] = useActionState(
    removeFindingEvidenceLinkAction,
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
        <input type="hidden" name="findingId" value={findingId} />
        <input type="hidden" name="investigationId" value={investigationId} />
        <Button className="self-start" type="submit" variant="ghost" size="xs" disabled={pending}>
          {pending ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Trash2 aria-hidden />
          )}
          Remove
        </Button>
        <Message state={state} />
      </FieldGroup>
    </form>
  );
}
