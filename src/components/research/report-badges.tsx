import { StatusLabel, type StatusTone } from "@/components/shared/status-label";
import { REPORT_STATUS_LABELS, type ReportStatus } from "@/modules/reports/domain/report";

const REPORT_STATUS_TONES: Record<ReportStatus, StatusTone> = {
  DRAFT: "neutral",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  EXPORTED: "success",
  ARCHIVED: "secondary",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return (
    <StatusLabel tone={REPORT_STATUS_TONES[status]}>{REPORT_STATUS_LABELS[status]}</StatusLabel>
  );
}
