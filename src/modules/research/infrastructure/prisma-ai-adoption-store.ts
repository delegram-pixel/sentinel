import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  hypothesisGenerationOutputSchema,
  reconAnalysisOutputSchema,
} from "@/modules/ai/domain/structured-output";
import { ResearchOperationError, type ResearchActor } from "@/modules/shared/application/actor";
import {
  lockResearchInvestigation,
  researchAudit,
} from "@/modules/shared/infrastructure/research-transaction";
import type { AiAdoptionInput, AiAdoptionStore } from "../application/ai-adoption-service";
export class PrismaAiAdoptionStore implements AiAdoptionStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  adopt(actor: ResearchActor, input: AiAdoptionInput) {
    return this.db.$transaction(async (tx) => {
      const task = await tx.aITask.findFirst({
        where: { id: input.taskId, workspaceId: actor.workspaceId, status: "COMPLETED" },
        select: {
          id: true,
          taskType: true,
          output: true,
          investigationId: true,
          inputContext: true,
        },
      });
      if (!task)
        throw new ResearchOperationError(
          "INVALID_SOURCE",
          "Choose a completed analytical result in this workspace.",
        );
      await lockResearchInvestigation(tx, actor, task.investigationId);
      const key = `ai-adoption:${task.id}:${input.kind}:${input.index}`;
      const prior = await tx.researchDecision.findUnique({
        where: { legacySourceId: key },
        select: { id: true, sourceRefs: true },
      });
      if (prior) {
        const refs = prior.sourceRefs as Array<{ id?: string }>;
        if (!Array.isArray(refs) || !refs[0]?.id)
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "The previous adoption record is incomplete.",
          );
        return { id: refs[0].id };
      }
      let id: string;
      if (input.kind === "HYPOTHESIS") {
        if (task.taskType !== "HYPOTHESIS_GENERATION")
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "This result does not contain hypothesis suggestions.",
          );
        const parsed = hypothesisGenerationOutputSchema.safeParse(task.output);
        const hypothesis = parsed.success ? parsed.data.hypotheses[input.index] : undefined;
        if (!hypothesis)
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "The selected hypothesis suggestion is unavailable.",
          );
        const selected =
          (task.inputContext as { sourceManifest?: { observationIds?: string[] } } | null)
            ?.sourceManifest?.observationIds ?? [];
        if (hypothesis.supportingObservationIds.some((id) => !selected.includes(id)))
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "A suggestion cites an unavailable source.",
          );
        const observations = await tx.investigationObservation.findMany({
          where: {
            id: { in: hypothesis.supportingObservationIds },
            investigationId: task.investigationId,
          },
          select: { id: true },
        });
        if (observations.length !== new Set(hypothesis.supportingObservationIds).size)
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "A supporting observation is no longer available.",
          );
        const row = await tx.hypothesis.create({
          data: {
            investigationId: task.investigationId,
            title: hypothesis.title,
            description: hypothesis.description,
            vulnerabilityCategory: hypothesis.vulnerabilityCategory,
            missingInformation: hypothesis.missingInformation,
            status: "IDEA",
            createdBy: actor.userId,
            observationLinks: {
              create: observations.map((o) => ({
                observationId: o.id,
                relationshipType: "SUPPORTS",
                createdBy: actor.userId,
              })),
            },
          },
          select: { id: true },
        });
        id = row.id;
      } else {
        if (task.taskType !== "RECON_ANALYSIS")
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "This result does not contain observation suggestions.",
          );
        const parsed = reconAnalysisOutputSchema.safeParse(task.output);
        const observation = parsed.success ? parsed.data.observations[input.index] : undefined;
        if (!observation)
          throw new ResearchOperationError(
            "INVALID_SOURCE",
            "The selected observation suggestion is unavailable.",
          );
        const row = await tx.investigationObservation.create({
          data: {
            investigationId: task.investigationId,
            title: observation.title,
            description: observation.description,
            observationType: "AI_OBSERVATION",
            confidenceLabel: "UNKNOWN",
            source: `AI interpretation from task ${task.id}; researcher adopted for further review`,
            createdBy: actor.userId,
          },
          select: { id: true },
        });
        id = row.id;
      }
      const decision = await tx.researchDecision.create({
        data: {
          workspaceId: actor.workspaceId,
          investigationId: task.investigationId,
          sourceTaskId: task.id,
          kind: "ADOPT_AI_RESULT",
          rationale: input.rationale,
          sourceRefs: [{ kind: input.kind, id, relationship: "CONTEXT" }],
          legacySourceId: key,
          createdBy: actor.userId,
        },
        select: { id: true },
      });
      await researchAudit(tx, actor, input.kind, id, "AI_SUGGESTION_ADOPTED", {
        taskId: task.id,
        index: input.index,
        decisionId: decision.id,
      });
      return { id };
    });
  }
}
