import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewProjectForm } from "@/components/research/new-project-form";
import { TooltipProvider } from "@/components/ui/tooltip";

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/app/(dashboard)/dashboard/projects/actions", () => ({
  createProjectAction: vi.fn(),
  updateProjectAction: vi.fn(),
}));
vi.mock("@/app/(dashboard)/dashboard/projects/bounty-actions", () => ({
  importBountyAction: vi.fn(),
  cancelBountyImportAction: vi.fn(),
  saveBountyProjectAction: vi.fn(),
}));

const draft = {
  name: "Example Bounty",
  description: "Example program research",
  programName: "Example",
  programUrl: "https://example.com/bounty",
  sourceUrl: null,
  authorizationNotes: "No denial of service.",
  effectiveFrom: null,
  effectiveUntil: null,
  warnings: [],
  assets: [
    {
      assetIdentifier: "app.example.com",
      assetType: "DOMAIN",
      matchType: "EXACT",
      effect: "ALLOWED",
      notes: "",
      sourceQuote: "Allowed: app.example.com",
    },
  ],
};

beforeEach(() => router.replace.mockReset());

describe("new project form tabs", () => {
  it("preserves pasted bounty details and manual project fields when switching tabs", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <NewProjectForm />
      </TooltipProvider>,
    );
    fireEvent.change(screen.getByLabelText("Program URL"), {
      target: { value: "https://example.com/bounty" },
    });
    fireEvent.change(screen.getByLabelText("Program details"), {
      target: { value: "Allowed: app.example.com. No denial of service." },
    });
    await user.click(screen.getByLabelText("Read program URL"));
    await user.click(screen.getByRole("tab", { name: "Create manually" }));
    fireEvent.change(screen.getByLabelText("Name", { exact: true }), {
      target: { value: "Manual project" },
    });
    fireEvent.change(screen.getByLabelText("Description", { exact: true }), {
      target: { value: "Keep this manual description." },
    });
    await user.selectOptions(screen.getByLabelText("Project type"), "BUG_BOUNTY");

    await user.click(screen.getByRole("tab", { name: "Import bounty with AI" }));
    expect(screen.getByLabelText("Program URL")).toHaveValue("https://example.com/bounty");
    expect(screen.getByLabelText("Program details")).toHaveValue(
      "Allowed: app.example.com. No denial of service.",
    );
    expect(screen.getByLabelText("Read program URL")).not.toBeChecked();
    await user.click(screen.getByRole("tab", { name: "Create manually" }));
    expect(screen.getByLabelText("Name", { exact: true })).toHaveValue("Manual project");
    expect(screen.getByLabelText("Description", { exact: true })).toHaveValue(
      "Keep this manual description.",
    );
    expect(screen.getByLabelText("Project type")).toHaveValue("BUG_BOUNTY");
  });

  it("preserves reviewed suggestions, added assets and review choices across tab switches", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ kind: "BOUNTY_IMPORT", status: "SUCCEEDED", result: { draft } }),
      ),
    );
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <NewProjectForm initialJobId="00000000-0000-4000-8000-000000000001" />
      </TooltipProvider>,
    );
    fireEvent.change(await screen.findByLabelText("Project name"), {
      target: { value: "Reviewed project" },
    });
    await user.click(screen.getByRole("button", { name: "Add asset" }));
    fireEvent.change(screen.getAllByLabelText("Asset identifier")[1]!, {
      target: { value: "api.example.com" },
    });
    await user.click(screen.getByLabelText("Analyze supplied content"));
    await user.click(screen.getByLabelText(/I reviewed the imported fields/));
    await user.click(screen.getByRole("tab", { name: "Create manually" }));
    await user.click(screen.getByRole("tab", { name: "Import bounty with AI" }));

    expect(await screen.findByLabelText("Project name")).toHaveValue("Reviewed project");
    expect(screen.getAllByLabelText("Asset identifier")).toHaveLength(2);
    expect(screen.getAllByLabelText("Asset identifier")[1]).toHaveValue("api.example.com");
    expect(screen.getByLabelText("Analyze supplied content")).toBeChecked();
    expect(screen.getByLabelText(/I reviewed the imported fields/)).toBeChecked();
    expect(screen.getByLabelText("Effective from")).toHaveValue("");
    expect(screen.getByLabelText("Effective until")).toHaveValue("");
  });
});
