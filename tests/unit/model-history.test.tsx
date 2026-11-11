import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ModelHistory } from "@/components/ai/model-history";
it("shows missing review stages, disagreements and traceable model usage without raw request data", async () => {
  const user = userEvent.setup();
  render(
    <ModelHistory
      attempts={[
        {
          id: "attempt",
          provider: "GEMINI",
          model: "gemini-3.8-flash",
          returnedModel: "gemini-3.8-flash",
          host: null,
          status: "RECEIVED",
          inputTokens: 100,
          outputTokens: 20,
          latencyMs: 400,
          retryCount: 1,
          fallbackFrom: "original-model",
          estimatedCostUsd: 0.001,
          task: { taskType: "PATTERN_ANALYSIS" },
        },
      ]}
      collaborations={[
        {
          id: "run",
          status: "INCOMPLETE",
          result: {
            failures: [{ stage: "REVIEW", code: "AI_NO_COMPATIBLE_MODEL" }],
            conflicts: [
              {
                subject: "FINDING:fixture",
                positions: [
                  {
                    taskId: "primary",
                    conclusion: { conclusion: "SUPPORTED", reasoning: "Primary interpretation." },
                  },
                  {
                    taskId: "secondary",
                    conclusion: {
                      conclusion: "UNSUPPORTED",
                      reasoning: "Alternative interpretation.",
                    },
                  },
                ],
              },
            ],
          },
          tasks: [
            {
              id: "primary",
              provider: "GEMINI",
              model: "gemini-3.8-flash",
              collaborationStage: "PRIMARY",
              output: null,
              evaluation: {
                version: 1,
                claims: [
                  {
                    id: "claim-limitation",
                    statement: "Source interpretation needs review.",
                    basis: "UNKNOWN",
                    confidence: "low",
                    limitations: ["No vulnerability confirmed."],
                    sources: [],
                  },
                ],
                conclusions: [],
              },
            },
          ],
        },
      ]}
    />,
  );
  expect(screen.getByText("Collaborative review · INCOMPLETE")).toBeInTheDocument();
  expect(screen.getByText(/REVIEW: AI_NO_COMPATIBLE_MODEL/)).toBeInTheDocument();
  expect(screen.getByText(/SUPPORTED: Primary interpretation/)).toBeInTheDocument();
  expect(screen.getByText(/UNSUPPORTED: Alternative interpretation/)).toBeInTheDocument();
  expect(screen.getByText("100 input / 20 output")).toBeInTheDocument();
  await user.click(screen.getByText("PRIMARY · GEMINI · gemini-3.8-flash"));
  expect(screen.getByText("Source interpretation needs review.")).toBeVisible();
});
