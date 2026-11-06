import { StatusLabel, type StatusTone } from "@/components/shared/status-label";
import {
  FINDING_STATUS_LABELS,
  SEVERITY_LABELS,
  type Severity,
} from "@/modules/findings/domain/finding";
import type { FindingStatus } from "@/modules/findings/domain/finding-status";
import {
  EVIDENCE_TYPE_LABELS,
  REDACTION_STATUS_LABELS,
  type EvidenceType,
  type RedactionStatus,
} from "@/modules/evidence/domain/evidence";

const FINDING_TONES: Record<FindingStatus, StatusTone> = {
  DRAFT: "neutral",
  NEEDS_VALIDATION: "warning",
  UNDER_REVIEW: "warning",
  CONFIRMED: "success",
  FALSE_POSITIVE: "secondary",
  REJECTED: "danger",
  REPORTABLE: "success",
  CLOSED: "secondary",
};

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <StatusLabel tone={FINDING_TONES[status]}>{FINDING_STATUS_LABELS[status]}</StatusLabel>;
}

const SEVERITY_TONES: Record<Severity, StatusTone> = {
  UNASSESSED: "secondary",
  INFORMATIONAL: "neutral",
  LOW: "neutral",
  MEDIUM: "warning",
  HIGH: "danger",
  CRITICAL: "danger",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <StatusLabel tone={SEVERITY_TONES[severity]}>{SEVERITY_LABELS[severity]}</StatusLabel>;
}

const REDACTION_TONES: Record<RedactionStatus, StatusTone> = {
  NOT_REVIEWED: "warning",
  QUARANTINED: "danger",
  REDACTED: "success",
  VERIFIED_SAFE: "success",
};

export function RedactionStatusBadge({ status }: { status: RedactionStatus }) {
  return (
    <StatusLabel tone={REDACTION_TONES[status]}>{REDACTION_STATUS_LABELS[status]}</StatusLabel>
  );
}

export function EvidenceTypeLabel({ type }: { type: EvidenceType }) {
  return <StatusLabel tone="secondary">{EVIDENCE_TYPE_LABELS[type]}</StatusLabel>;
}
