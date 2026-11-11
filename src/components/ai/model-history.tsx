import { Disclosure } from "@/components/shared/disclosure";
import { ResearchSection } from "@/components/shared/research-section";
import { RecordTable } from "@/components/shared/record-table";
import {
  analysisEvaluationSchema,
  conclusionReviewSchema,
} from "@/modules/ai/domain/collaboration-output";

export type ModelAttemptView = {
  id: string;
  provider: string | null;
  model: string | null;
  returnedModel: string | null;
  host: string | null;
  status: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  retryCount: number;
  fallbackFrom: string | null;
  estimatedCostUsd: number | null;
  task: { taskType: string };
};
export type CollaborationView = {
  id: string;
  status: string;
  tasks: Array<{
    id: string;
    provider: string;
    model: string;
    collaborationStage: string | null;
    evaluation: unknown;
    output: unknown;
  }>;
  result: unknown;
};
export function ModelHistory({
  attempts,
  collaborations,
}: {
  attempts: ModelAttemptView[];
  collaborations: CollaborationView[];
}) {
  return (
    <ResearchSection
      id="model-contributions"
      title="Model contributions"
      description="See which models contributed, where they disagreed, and which reviews remain incomplete. Findings still require human review."
    >
      {collaborations.map((run) => {
        const result = run.result as {
          conflicts?: Array<{
            subject: string;
            positions: Array<{
              taskId: string;
              conclusion: { conclusion: string; reasoning: string };
            }>;
          }>;
          failures?: Array<{ stage: string; code: string }>;
        } | null;
        return (
          <article key={run.id} className="research-record mb-4">
            <p className="font-medium">Collaborative review · {run.status}</p>
            {result?.failures?.map((failure, i) => (
              <p key={i} className="mt-2 text-sm text-danger">
                {failure.stage}: {failure.code}
              </p>
            ))}
            {result?.conflicts?.map((conflict) => (
              <div key={conflict.subject} className="mt-3">
                <p className="font-medium">Conflicting conclusions · {conflict.subject}</p>
                {conflict.positions.map((position) => (
                  <p key={position.taskId} className="mt-1 text-sm">
                    {position.conclusion.conclusion}: {position.conclusion.reasoning}
                  </p>
                ))}
              </div>
            ))}
            {run.tasks.map((task) => {
              const analysis = analysisEvaluationSchema.safeParse(task.evaluation);
              const review = conclusionReviewSchema.safeParse(task.output);
              return (
                <Disclosure
                  key={task.id}
                  title={`${task.collaborationStage} · ${task.provider} · ${task.model}`}
                  className="mt-3"
                >
                  {analysis.success
                    ? analysis.data.claims.map((claim) => (
                        <div key={claim.id} className="mb-3 text-sm">
                          <p>{claim.statement}</p>
                          <p className="text-text-secondary">
                            {claim.basis} · {claim.confidence} confidence
                          </p>
                          {claim.sources.map((source, i) => (
                            <p key={i} className="text-xs">
                              {source.relationship}: {source.kind} {source.id}
                            </p>
                          ))}
                          {claim.limitations.map((limitation, i) => (
                            <p key={i} className="text-text-secondary">
                              {limitation}
                            </p>
                          ))}
                        </div>
                      ))
                    : null}
                  {review.success ? (
                    <>
                      {review.data.reviews.map((item, i) => (
                        <div key={i} className="mb-2 text-sm">
                          <p>
                            {item.claimId} · {item.verdict}: {item.reasoning}
                          </p>
                          {item.sources.map((source, index) => (
                            <p key={index} className="text-xs">
                              {source.relationship}: {source.kind} {source.id}
                            </p>
                          ))}
                        </div>
                      ))}
                      {review.data.missingInformation.map((item, i) => (
                        <p key={i} className="mb-2 text-sm text-text-secondary">
                          Missing information: {item}
                        </p>
                      ))}
                    </>
                  ) : null}
                </Disclosure>
              );
            })}
          </article>
        );
      })}
      {attempts.length ? (
        <RecordTable caption="AI model execution history" minWidth="48rem">
          <thead>
            <tr>
              <th>Task and model</th>
              <th>Result</th>
              <th>Usage</th>
              <th>Latency</th>
              <th>Retries and fallback</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt) => (
              <tr key={attempt.id}>
                <td>
                  {attempt.task.taskType}
                  <p className="text-xs">
                    {attempt.provider} · {attempt.returnedModel ?? attempt.model}
                  </p>
                  {attempt.host ? <p className="text-xs">{attempt.host}</p> : null}
                </td>
                <td>{attempt.status}</td>
                <td>
                  {attempt.inputTokens} input / {attempt.outputTokens} output
                  <p className="text-xs">
                    {attempt.estimatedCostUsd === null
                      ? "Cost estimate unavailable"
                      : `Estimated $${attempt.estimatedCostUsd.toFixed(6)}`}
                  </p>
                </td>
                <td>{attempt.latencyMs === null ? "Unavailable" : `${attempt.latencyMs} ms`}</td>
                <td>
                  {attempt.retryCount} retries
                  {attempt.fallbackFrom ? (
                    <p className="text-xs">Fallback from {attempt.fallbackFrom}</p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </RecordTable>
      ) : (
        <p className="text-sm text-text-secondary">No model executions recorded.</p>
      )}
    </ResearchSection>
  );
}
