import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BountyReviewForm } from "@/components/research/bounty-review-form";

const { save } = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/app/(dashboard)/dashboard/projects/bounty-actions", () => ({
  saveBountyProjectAction: save,
}));
const draft = {
  name: "Example Bounty",
  description: "Research Example",
  programName: "Example",
  programUrl: "https://example.com/bounty",
  sourceUrl: null,
  authorizationNotes: "No denial of service.",
  effectiveFrom: null,
  effectiveUntil: null,
  warnings: ["Dates are missing."],
  assets: [
    {
      assetIdentifier: "app.example.com",
      assetType: "DOMAIN" as const,
      matchType: "EXACT" as const,
      effect: "ALLOWED" as const,
      notes: "",
      sourceQuote: "Allowed: app.example.com",
    },
  ],
};
beforeEach(() => {
  save.mockReset().mockResolvedValue({ ok: false, message: "Simulated persistence outage" });
});

describe("bounty review", () => {
  it("prefills fields, preserves missing dates, and sends human edits with acknowledgment", async () => {
    render(<BountyReviewForm draft={draft} importJobId="00000000-0000-4000-8000-000000000001" />);
    expect(screen.getByLabelText("Project name")).toHaveValue("Example Bounty");
    expect(screen.getByLabelText("Effective from")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "Reviewed Bounty" },
    });
    fireEvent.click(screen.getByLabelText("Analyze supplied content"));
    fireEvent.click(screen.getByLabelText(/I reviewed/));
    fireEvent.click(screen.getByRole("button", { name: "Create project and scope drafts" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toMatchObject({
      project: { name: "Reviewed Bounty", projectType: "BUG_BOUNTY" },
      effectiveFrom: "",
      effectiveUntil: "",
      permittedActivities: ["AI_ANALYZE_SUPPLIED_CONTENT"],
      acknowledged: true,
    });
    await screen.findByText("Simulated persistence outage");
    expect(screen.getByLabelText("Project name")).toHaveValue("Reviewed Bounty");
  });
  it("requires activity selection and prevents invalid assets from reaching persistence", async () => {
    render(<BountyReviewForm draft={draft} importJobId="00000000-0000-4000-8000-000000000001" />);
    fireEvent.click(screen.getByLabelText(/I reviewed/));
    fireEvent.click(screen.getByRole("button", { name: "Create project and scope drafts" }));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Select at least one activity");
    fireEvent.click(screen.getByLabelText("Analyze supplied content"));
    fireEvent.change(screen.getByLabelText("Asset identifier"), {
      target: { value: "invalid domain" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create project and scope drafts" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid domain");
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Asset identifier")).toHaveFocus();
  });
});
