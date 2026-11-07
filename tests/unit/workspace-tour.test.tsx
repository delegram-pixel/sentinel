import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AutomaticWorkspaceTour,
  ReplayWorkspaceTourButton,
  WorkspaceTourProvider,
} from "@/components/onboarding/workspace-tour-provider";
import {
  shouldShowWorkspaceTour,
  WORKSPACE_TOUR_VERSION,
  type DismissWorkspaceTourResult,
} from "@/modules/auth/domain/workspace-tour";

const { dismiss, push } = vi.hoisted(() => ({
  dismiss: vi.fn<() => Promise<DismissWorkspaceTourResult>>(),
  push: vi.fn(),
}));

vi.mock("@/app/(dashboard)/dashboard/tour-actions", () => ({
  dismissWorkspaceTourAction: dismiss,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/dynamic", async () => {
  const { WorkspaceTourDialog } = await import("@/components/onboarding/workspace-tour-dialog");
  return { default: () => WorkspaceTourDialog };
});

beforeEach(() => {
  dismiss.mockReset().mockResolvedValue({ ok: true });
  push.mockReset();
});

function TourHarness({ automatic = true }: { automatic?: boolean }) {
  return (
    <WorkspaceTourProvider>
      <main id="main-content" tabIndex={-1}>
        <h1>Dashboard</h1>
        <ReplayWorkspaceTourButton />
      </main>
      {automatic ? <AutomaticWorkspaceTour /> : null}
    </WorkspaceTourProvider>
  );
}

async function reachLastStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Start tour" }));
  while (screen.queryByRole("button", { name: "Next" })) {
    await user.click(screen.getByRole("button", { name: "Next" }));
  }
}

describe("workspace tour eligibility", () => {
  it("offers the tour only to newly provisioned users with unfinished current-version progress", () => {
    expect(
      shouldShowWorkspaceTour({
        onboardingVersion: WORKSPACE_TOUR_VERSION,
        onboardingCompletedAt: null,
      }),
    ).toBe(true);
    expect(shouldShowWorkspaceTour({ onboardingVersion: 1, onboardingCompletedAt: null })).toBe(
      false,
    );
    expect(
      shouldShowWorkspaceTour({
        onboardingVersion: WORKSPACE_TOUR_VERSION,
        onboardingCompletedAt: new Date(),
      }),
    ).toBe(false);
    expect(
      shouldShowWorkspaceTour({
        onboardingVersion: WORKSPACE_TOUR_VERSION + 1,
        onboardingCompletedAt: null,
      }),
    ).toBe(false);
    expect(shouldShowWorkspaceTour(null)).toBe(false);
  });
});

describe("workspace tour interactions", () => {
  it("opens automatically with a labelled dialog, initial focus, and keyboard focus containment", async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <TourHarness />
      </StrictMode>,
    );
    const dialog = await screen.findByRole("dialog", { name: "Your research starts here." });
    expect(dialog).toHaveAccessibleDescription(/Welcome to Sentinel Research/);
    expect(screen.getByRole("button", { name: "Start tour" })).toHaveFocus();
    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("lets users move forward and back, including from the final step", async () => {
    const user = userEvent.setup();
    render(<TourHarness />);
    await user.click(screen.getByRole("button", { name: "Start tour" }));
    expect(screen.getByRole("dialog", { name: "Start with a clear boundary." })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Your research starts here." })).toBeVisible();
    await reachLastStep(user);
    expect(
      screen.getByRole("dialog", { name: "Share the work. Track what follows." }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Make the finding defensible." })).toBeVisible();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("dismisses open step help before Escape dismisses the tour", async () => {
    const user = userEvent.setup();
    render(<TourHarness />);
    await user.click(screen.getByRole("button", { name: "Help for Finding your way" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("On a desktop, use the sidebar");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(dismiss).not.toHaveBeenCalled();
  });

  it("saves Escape dismissal once and does not reopen when automatic eligibility streams again", async () => {
    const user = userEvent.setup();
    const view = render(<TourHarness />);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dismiss).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
    view.rerender(<TourHarness automatic={false} />);
    view.rerender(<TourHarness />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps existing users uninterrupted, supports replay, and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    render(<TourHarness automatic={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Replay workspace tour" });
    await user.click(trigger);
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(
      within(screen.getByRole("dialog")).getAllByRole("button", { name: "Skip tour" })[1]!,
    );
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Your research starts here." })).toBeVisible();
  });

  it("persists completion before navigating to the first project", async () => {
    const user = userEvent.setup();
    render(<TourHarness />);
    await reachLastStep(user);
    await user.click(screen.getByRole("button", { name: "Create a project" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledExactlyOnceWith("/dashboard/projects/new");
  });

  it("finishes without navigation when the user wants to explore", async () => {
    const user = userEvent.setup();
    render(<TourHarness />);
    await reachLastStep(user);
    await user.click(screen.getByRole("button", { name: "Finish tour" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("prevents duplicate saves while a dismissal is pending", async () => {
    const user = userEvent.setup();
    let resolveSave!: (result: DismissWorkspaceTourResult) => void;
    dismiss.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    render(<TourHarness />);
    await user.click(screen.getAllByRole("button", { name: "Skip tour" })[1]!);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    await user.keyboard("{Escape}{Escape}");
    expect(dismiss).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveSave({ ok: true });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a retryable save failure and allows closing without blocking the dashboard", async () => {
    const user = userEvent.setup();
    dismiss.mockResolvedValue({
      ok: false,
      message: "Unable to save. Close for now or try again.",
    });
    render(<TourHarness />);
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save.");
    expect(screen.getByRole("dialog")).toBeVisible();
    const close = screen.getByRole("button", { name: "Close for now" });
    await waitFor(() => expect(close).toBeEnabled());
    await user.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });

  it("recovers from a transport error when the user retries dismissal", async () => {
    const user = userEvent.setup();
    dismiss.mockRejectedValueOnce(new Error("Network unavailable"));
    render(<TourHarness />);
    await user.keyboard("{Escape}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn’t save your tour preference.",
    );
    const skip = screen.getAllByRole("button", { name: "Skip tour" })[1]!;
    await waitFor(() => expect(skip).toBeEnabled());
    await user.click(skip);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dismiss).toHaveBeenCalledTimes(2);
  });
});
