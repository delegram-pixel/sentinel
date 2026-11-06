import { StatusLabel, type StatusTone } from "@/components/shared/status-label";
import {
  HYPOTHESIS_STATUS_LABELS,
  INVESTIGATION_STATUS_LABELS,
  type HypothesisStatus,
  type InvestigationStatus,
} from "@/modules/research/domain/investigation";

const investigationTone: Record<InvestigationStatus, StatusTone> = {
  DRAFT: "secondary",
  ACTIVE: "neutral",
  PAUSED: "warning",
  UNDER_REVIEW: "warning",
  COMPLETED: "success",
  ARCHIVED: "secondary",
};
const hypothesisTone: Record<HypothesisStatus, StatusTone> = {
  IDEA: "secondary",
  OBSERVED: "neutral",
  NEEDS_VALIDATION: "warning",
  CONFIRMED: "success",
  NOT_REPRODUCIBLE: "secondary",
  REJECTED: "danger",
};
export function InvestigationStatusBadge({ status }: { status: InvestigationStatus }) {
  return (
    <StatusLabel tone={investigationTone[status]}>
      {INVESTIGATION_STATUS_LABELS[status]}
    </StatusLabel>
  );
}
export function HypothesisStatusBadge({ status }: { status: HypothesisStatus }) {
  return (
    <StatusLabel tone={hypothesisTone[status]}>{HYPOTHESIS_STATUS_LABELS[status]}</StatusLabel>
  );
}
