import { StatusLabel, type StatusTone } from "@/components/shared/status-label";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  type ProjectStatus,
  type ProjectType,
} from "@/modules/research/domain/project";
import { SCOPE_STATUS_LABELS, type ScopeStatus } from "@/modules/research/domain/scope";
import {
  TARGET_AUTHORIZATION_LABELS,
  type TargetAuthorizationStatus,
} from "@/modules/research/domain/target";

const projectTone: Record<ProjectStatus, StatusTone> = {
  ACTIVE: "neutral",
  PAUSED: "warning",
  COMPLETED: "success",
  ARCHIVED: "secondary",
};
const authorizationTone: Record<TargetAuthorizationStatus, StatusTone> = {
  AUTHORIZED: "success",
  PENDING: "warning",
  EXPIRED: "warning",
  REVOKED: "danger",
  UNVERIFIED: "secondary",
};
const scopeTone: Record<ScopeStatus, StatusTone> = {
  ACTIVE: "success",
  DRAFT: "warning",
  SUPERSEDED: "secondary",
  EXPIRED: "warning",
  REVOKED: "danger",
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <StatusLabel tone={projectTone[status]}>{PROJECT_STATUS_LABELS[status]}</StatusLabel>;
}
export function ProjectTypeBadge({ projectType }: { projectType: ProjectType }) {
  return <StatusLabel tone="secondary">{PROJECT_TYPE_LABELS[projectType]}</StatusLabel>;
}
export function TargetAuthorizationBadge({ status }: { status: TargetAuthorizationStatus }) {
  return (
    <StatusLabel tone={authorizationTone[status]}>
      {TARGET_AUTHORIZATION_LABELS[status]}
    </StatusLabel>
  );
}
export function ScopeStatusBadge({ status }: { status: ScopeStatus }) {
  return <StatusLabel tone={scopeTone[status]}>{SCOPE_STATUS_LABELS[status]}</StatusLabel>;
}
