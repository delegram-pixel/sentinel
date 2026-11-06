import { z } from "zod";

import { optionalText } from "./fields";

export const PROJECT_TYPES = [
  "LEARNING_LAB",
  "BUG_BOUNTY",
  "AUTHORIZED_ASSESSMENT",
  "INTERNAL_RESEARCH",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_STATUSES = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const projectInputSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  description: optionalText(2000),
  projectType: z.enum(PROJECT_TYPES),
});

export type ProjectInput = z.infer<typeof projectInputSchema>;

/**
 * Generate a stable, URL-safe slug from a project name. Uniqueness within the
 * workspace is resolved by the service, not by adding entropy here.
 */
export function slugifyProjectName(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "project";
}

export function canEditProject(status: ProjectStatus): boolean {
  return status !== "ARCHIVED";
}

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  LEARNING_LAB: "Learning lab",
  BUG_BOUNTY: "Bug bounty",
  AUTHORIZED_ASSESSMENT: "Authorized assessment",
  INTERNAL_RESEARCH: "Internal research",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};
