/**
 * Allow-listed audit actions. Audit rows are append-only and must never carry
 * secrets, credentials, or raw evidence (ENGINEERING §12).
 */
export const AUDIT_ACTIONS = [
  "WORKSPACE_PROVISIONED",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "PROJECT_ARCHIVED",
  "TARGET_CREATED",
  "TARGET_UPDATED",
  "TARGET_AUTHORIZATION_RECOMPUTED",
  "SCOPE_DRAFT_CREATED",
  "SCOPE_ACTIVATED",
  "SCOPE_REVOKED",
  "AUTHORIZATION_DENIED",
  "INVESTIGATION_CREATED",
  "INVESTIGATION_UPDATED",
  "INVESTIGATION_STATUS_CHANGED",
  "OBSERVATION_CREATED",
  "OBSERVATION_UPDATED",
  "HYPOTHESIS_CREATED",
  "HYPOTHESIS_UPDATED",
  "HYPOTHESIS_STATUS_CHANGED",
  "SESSION_SUMMARY_CREATED",
  "FINDING_CREATED",
  "FINDING_UPDATED",
  "FINDING_STATUS_CHANGED",
  "FINDING_SEVERITY_ASSESSED",
  "FINDING_DUPLICATE_CONFIRMED",
  "FINDING_VERIFICATION_REVIEWED",
  "EVIDENCE_UPLOAD_INTENT_CREATED",
  "EVIDENCE_UPLOADED",
  "EVIDENCE_UPDATED",
  "EVIDENCE_REDACTION_REVIEWED",
  "EVIDENCE_REDACTION_REJECTED",
  "EVIDENCE_LINKED",
  "EVIDENCE_LINK_REMOVED",
  "EVIDENCE_DELETED",
  "REPORT_CREATED",
  "REPORT_REVISION_SAVED",
  "REPORT_STATUS_CHANGED",
  "REPORT_EXPORTED",
  "REPORT_TEMPLATE_CREATED",
  "REPORT_TEMPLATE_UPDATED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  WORKSPACE_PROVISIONED: "Personal workspace created",
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
  PROJECT_ARCHIVED: "Project archived",
  TARGET_CREATED: "Target registered",
  TARGET_UPDATED: "Target updated",
  TARGET_AUTHORIZATION_RECOMPUTED: "Target authorization updated",
  SCOPE_DRAFT_CREATED: "Scope draft created",
  SCOPE_ACTIVATED: "Scope activated",
  SCOPE_REVOKED: "Scope revoked",
  AUTHORIZATION_DENIED: "Authorization denied",
  INVESTIGATION_CREATED: "Investigation created",
  INVESTIGATION_UPDATED: "Investigation updated",
  INVESTIGATION_STATUS_CHANGED: "Investigation status changed",
  OBSERVATION_CREATED: "Observation recorded",
  OBSERVATION_UPDATED: "Observation updated",
  HYPOTHESIS_CREATED: "Hypothesis created",
  HYPOTHESIS_UPDATED: "Hypothesis updated",
  HYPOTHESIS_STATUS_CHANGED: "Hypothesis status changed",
  SESSION_SUMMARY_CREATED: "Session summary recorded",
  FINDING_CREATED: "Finding created",
  FINDING_UPDATED: "Finding updated",
  FINDING_STATUS_CHANGED: "Finding status changed",
  FINDING_SEVERITY_ASSESSED: "Finding severity assessed",
  FINDING_DUPLICATE_CONFIRMED: "Finding duplicate confirmed",
  FINDING_VERIFICATION_REVIEWED: "Finding verification reviewed",
  EVIDENCE_UPLOAD_INTENT_CREATED: "Evidence upload started",
  EVIDENCE_UPLOADED: "Evidence uploaded",
  EVIDENCE_UPDATED: "Evidence metadata updated",
  EVIDENCE_REDACTION_REVIEWED: "Evidence redaction reviewed",
  EVIDENCE_REDACTION_REJECTED: "Evidence rejected during redaction review",
  EVIDENCE_LINKED: "Evidence linked to a finding",
  EVIDENCE_LINK_REMOVED: "Evidence link removed",
  EVIDENCE_DELETED: "Evidence deleted",
  REPORT_CREATED: "Report created",
  REPORT_REVISION_SAVED: "Report revision saved",
  REPORT_STATUS_CHANGED: "Report status changed",
  REPORT_EXPORTED: "Report exported",
  REPORT_TEMPLATE_CREATED: "Report template created",
  REPORT_TEMPLATE_UPDATED: "Report template updated",
};

export function auditActionLabel(action: string): string {
  if (!AUDIT_ACTIONS.includes(action as AuditAction)) {
    return "Activity recorded";
  }

  return AUDIT_ACTION_LABELS[action as AuditAction];
}

export type AuditEvent = {
  workspaceId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};
