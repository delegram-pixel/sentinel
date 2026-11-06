import { describe, expect, it } from "vitest";

import {
  canEditProject,
  projectInputSchema,
  slugifyProjectName,
} from "@/modules/research/domain/project";

describe("project domain", () => {
  it("accepts a valid project", () => {
    expect(
      projectInputSchema.safeParse({
        name: "Local lab",
        description: "",
        projectType: "LEARNING_LAB",
      }).success,
    ).toBe(true);
  });

  it("rejects a name that is too short", () => {
    expect(projectInputSchema.safeParse({ name: "A", projectType: "LEARNING_LAB" }).success).toBe(
      false,
    );
  });

  it("rejects an unknown project type", () => {
    expect(
      projectInputSchema.safeParse({ name: "Local lab", projectType: "SOMETHING_ELSE" }).success,
    ).toBe(false);
  });

  it("slugifies names and falls back when nothing remains", () => {
    expect(slugifyProjectName("My Project!!")).toBe("my-project");
    expect(slugifyProjectName("  Café Lab  ")).toBe("cafe-lab");
    expect(slugifyProjectName("***")).toBe("project");
  });

  it("prevents edits to an archived project", () => {
    expect(canEditProject("ACTIVE")).toBe(true);
    expect(canEditProject("ARCHIVED")).toBe(false);
  });
});
