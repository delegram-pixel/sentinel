import { describe, expect, it } from "vitest";

import { isNavItemActive, NAV_GROUPS } from "@/components/layout/nav";

describe("navigation", () => {
  it("matches the dashboard root exactly", () => {
    const dashboard = NAV_GROUPS[0]?.items[0];
    expect(dashboard).toBeDefined();
    if (!dashboard) {
      return;
    }

    expect(isNavItemActive("/dashboard", dashboard)).toBe(true);
    expect(isNavItemActive("/dashboard/projects", dashboard)).toBe(false);
  });

  it("matches nested routes for section links", () => {
    const projects = NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.href === "/dashboard/projects",
    );
    expect(projects).toBeDefined();
    if (!projects) {
      return;
    }

    expect(isNavItemActive("/dashboard/projects", projects)).toBe(true);
    expect(isNavItemActive("/dashboard/projects/abc", projects)).toBe(true);
    expect(isNavItemActive("/dashboard/investigations", projects)).toBe(false);
  });

  it("does not match a shared prefix without a separator", () => {
    const projects = NAV_GROUPS.flatMap((group) => group.items).find(
      (item) => item.href === "/dashboard/projects",
    );
    expect(projects).toBeDefined();
    if (!projects) {
      return;
    }

    expect(isNavItemActive("/dashboard/projects-archive", projects)).toBe(false);
  });

  it.each([
    ["/dashboard/projects/project-id/targets", "/dashboard/targets"],
    ["/dashboard/projects/project-id/targets/target-id/scopes/scope-id", "/dashboard/targets"],
    ["/dashboard/projects/project-id/investigations", "/dashboard/investigations"],
  ])("keeps one relevant section active on %s", (pathname, expectedHref) => {
    const active = NAV_GROUPS.flatMap((group) => group.items).filter((item) =>
      isNavItemActive(pathname, item),
    );
    expect(active.map((item) => item.href)).toEqual([expectedHref]);
  });
});
