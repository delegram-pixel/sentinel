import { StatusLabel, type StatusTone } from "@/components/shared/status-label";
import type { AiTaskStatus } from "@/modules/ai/domain/ai-task-status";

const tones: Record<AiTaskStatus, StatusTone> = {
  PENDING: "neutral",
  RUNNING: "secondary",
  AWAITING_APPROVAL: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
  TIMED_OUT: "warning",
};
const labels: Record<AiTaskStatus, string> = {
  PENDING: "Pending",
  RUNNING: "Running",
  AWAITING_APPROVAL: "Awaiting approval",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
  TIMED_OUT: "Timed out",
};
export function AiTaskStatusBadge({ status }: { status: AiTaskStatus }) {
  return <StatusLabel tone={tones[status]}>{labels[status]}</StatusLabel>;
}
