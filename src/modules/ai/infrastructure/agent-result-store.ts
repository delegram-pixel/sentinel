import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  evidenceAnalysisOutputSchema,
  independentVerificationOutputSchema,
} from "../domain/agent-output";
import { AiError } from "../domain/ai-errors";
export async function persistAgentAssessments(
  tx: Prisma.TransactionClient,
  task: {
    id: string;
    taskType: string;
    contextVersion: string;
    inputContext: Prisma.JsonValue | null;
    investigationId: string;
  },
  workspaceId: string,
  output: unknown,
) {
  const basis = {
    sourceTaskId: task.id,
    contextVersion: task.contextVersion,
    sourceManifest:
      (task.inputContext as { sourceManifest?: unknown } | null)?.sourceManifest ?? null,
  } as Prisma.InputJsonValue;
  if (task.taskType === "EVIDENCE_REVIEW") {
    const parsed = evidenceAnalysisOutputSchema.safeParse(output);
    if (!parsed.success) throw new AiError("AI_OUTPUT_VALIDATION_FAILED");
    for (const assessment of parsed.data.assessments) {
      const evidence = await tx.evidence.findFirst({
        where: {
          id: assessment.evidenceId,
          workspaceId,
          investigationId: task.investigationId,
          deletedAt: null,
          redactionStatus: { in: ["REDACTED", "VERIFIED_SAFE"] },
        },
        select: { version: true, checksum: true },
      });
      if (!evidence) throw new AiError("AI_PERMISSION_DENIED");
      await tx.evidenceAssessment.create({
        data: {
          workspaceId,
          evidenceId: assessment.evidenceId,
          sourceTaskId: task.id,
          assessorType: "AI",
          assessment,
          basis: {
            ...(basis as object),
            evidenceVersion: evidence.version,
            checksum: evidence.checksum,
          },
        },
      });
    }
  }
  if (task.taskType === "FALSE_POSITIVE_REVIEW") {
    const parsed = independentVerificationOutputSchema.safeParse(output);
    if (!parsed.success) throw new AiError("AI_OUTPUT_VALIDATION_FAILED");
    for (const finding of parsed.data.findings) {
      if (
        !(await tx.finding.findFirst({
          where: { id: finding.findingId, workspaceId, investigationId: task.investigationId },
          select: { id: true },
        }))
      )
        throw new AiError("AI_PERMISSION_DENIED");
      await tx.verificationReview.create({
        data: {
          findingId: finding.findingId,
          taskId: task.id,
          reviewerType: "AI",
          conclusion: finding.conclusion,
          supportingEvidence: finding.supportingEvidenceIds,
          contradictingEvidence: finding.contradictoryEvidenceIds,
          reasoningSummary: finding.reasoning,
          basis,
        },
      });
    }
  }
}
