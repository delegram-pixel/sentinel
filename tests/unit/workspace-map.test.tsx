import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/app-shell";
import { NAV_GROUPS } from "@/components/layout/nav";
import {
  isWorkspaceMapDestinationActive,
  WORKSPACE_MAP_STAGES,
  WORKSPACE_MAP_UTILITIES,
} from "@/components/onboarding/workspace-map-data";
import {
  WorkspaceMapEntry,
  WorkspaceMapProvider,
} from "@/components/onboarding/workspace-map-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const navigation = vi.hoisted(() => ({ pathname: "/dashboard", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/dynamic", async () => {
  const { WorkspaceMapDialog } = await import("@/components/onboarding/workspace-map-dialog");
  return { default: () => WorkspaceMapDialog };
});
vi.mock("next/link", () => ({
  default: ({
    href,
    onNavigate,
    prefetch: _prefetch,
    ...props
  }: ComponentProps<"a"> & {
    onNavigate?: () => void;
    prefetch?: boolean;
  }) => {
    void _prefetch;
    return (
      <a
        {...props}
        href={href}
        onClick={(event) => {
          props.onClick?.(event);
          event.preventDefault();
          if (!event.ctrlKey && !event.metaKey) {
            onNavigate?.();
            navigation.push(href);
          }
        }}
      />
    );
  },
}));

beforeEach(() => {
  navigation.pathname = "/dashboard";
  navigation.push.mockReset();
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue(
    Object.assign([new DOMRect()], { item: () => new DOMRect() }),
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

function Harness() {
  return (
    <TooltipProvider>
      <WorkspaceMapProvider>
        <AppShell>
          <h1>Research overview</h1>
          <WorkspaceMapEntry />
        </AppShell>
      </WorkspaceMapProvider>
    </TooltipProvider>
  );
}

describe("workspace map destinations", () => {
  it("covers every sidebar destination exactly once", () => {
    const destinations = [
      ...WORKSPACE_MAP_STAGES.flatMap((stage) => [stage, ...stage.branches]),
      ...WORKSPACE_MAP_UTILITIES,
    ].map((item) => item.href);
    expect(destinations.toSorted()).toEqual(
      NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)).toSorted(),
    );
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/projects/project-1", "/dashboard/projects"],
    ["/dashboard/projects/project-1/targets/target-1/scopes/new", "/dashboard/targets"],
    ["/dashboard/projects/project-1/investigations", "/dashboard/investigations"],
    ["/dashboard/reports/templates/new", "/dashboard/reports"],
    ["/dashboard/settings", "/dashboard/settings"],
  ])("places nested route %s at %s without extra location markers", (pathname, expected) => {
    const destinations = NAV_GROUPS.flatMap((group) => group.items);
    expect(
      destinations
        .filter((item) => isWorkspaceMapDestinationActive(pathname, item.href))
        .map((item) => item.href),
    ).toEqual([expected]);
  });
});

describe("workspace map interactions", () => {
  it("opens from the sidebar with a labelled dialog, contains focus, and restores it on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Workspace map" });
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Workspace map" });
    expect(dialog).toHaveAccessibleDescription(/Follow a question/);
    expect(within(dialog).getByRole("heading", { name: "Workspace map" })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Close workspace map" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(within(dialog).getByRole("link", { name: /^Settings/ })).toHaveFocus();
    await user.tab();
    expect(within(dialog).getByRole("button", { name: "Close workspace map" })).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("opens from the dashboard and puts the location marker on a project-scoped target", async () => {
    navigation.pathname = "/dashboard/projects/project-1/targets/target-1";
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open workspace map" }));
    const dialog = await screen.findByRole("dialog", { name: "Workspace map" });
    const current = dialog.querySelectorAll('[aria-current="page"]');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute("href", "/dashboard/targets");
    expect(current[0]).toHaveTextContent("You are here");
    expect(within(dialog).getAllByText("You are here")).toHaveLength(1);
  });

  it("dismisses on navigation and sends focus to content, while modifier clicks keep the map open", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open workspace map" }));
    const dialog = await screen.findByRole("dialog", { name: "Workspace map" });
    const findings = within(dialog).getByRole("link", { name: /Findings/ });
    await user.keyboard("{Control>}");
    await user.click(findings);
    await user.keyboard("{/Control}");
    expect(dialog).toBeVisible();
    expect(navigation.push).not.toHaveBeenCalled();
    await user.click(findings);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith("/dashboard/findings");
    await waitFor(() => expect(screen.getByRole("main")).toHaveFocus());
  });

  it("hands off from the mobile drawer and restores focus to the navigation button", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const menu = screen.getByRole("button", { name: "Open navigation" });
    await user.click(menu);
    const drawer = await screen.findByRole("dialog", { name: "Navigation" });
    await user.click(within(drawer).getByRole("button", { name: "Workspace map" }));
    const map = await screen.findByRole("dialog", { name: "Workspace map" });
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
    expect(within(map).getByRole("heading", { name: "Workspace map" })).toHaveFocus();
    await user.click(within(map).getByRole("button", { name: "Close workspace map" }));
    await waitFor(() => expect(menu).toHaveFocus());
  });
});
