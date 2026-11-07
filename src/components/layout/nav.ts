export type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
  help?: { description: string; example: string; note?: string };
};

export type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        exact: true,
        help: {
          description:
            "Your workspace overview brings together recent research and links to the records that need attention.",
          example:
            "Start a project, return to a recent investigation, or follow a finding into its supporting evidence.",
        },
      },
      {
        label: "Research insights",
        href: "/dashboard/insights",
        help: {
          description:
            "Review recorded research activity and outcomes across the workspace to understand progress and recurring patterns.",
          example: "Look at open findings and remediation outcomes when planning the next review.",
          note: "Insights reflect saved records; they do not independently verify a vulnerability.",
        },
      },
      {
        label: "Projects",
        href: "/dashboard/projects",
        help: {
          description:
            "A project groups related targets, investigations, and engagements. Create it before adding the assets you intend to research.",
          example:
            "Use a Learning lab project for a practice application, with one target and separate investigations for different questions.",
          note: "Project type describes the work. Authorization comes from an active scope on each target.",
        },
      },
      {
        label: "Investigations",
        href: "/dashboard/investigations",
        help: {
          description:
            "Keep a research question, observations, hypotheses, decisions, evidence, and AI conversations together in an attributable working record.",
          example:
            "Investigate whether a supplied response reveals another user's data; record both supporting and contradictory observations.",
        },
      },
      {
        label: "Engagements",
        href: "/dashboard/engagements",
        help: {
          description:
            "Group related research within a project around a defined objective. Associate existing targets and scope versions and track the engagement's progress.",
          example:
            "Create an engagement for a quarterly application review with its relevant targets and research objectives.",
          note: "An engagement association or status never replaces target scope authorization.",
        },
      },
    ],
  },
  {
    label: "Research",
    items: [
      {
        label: "Targets",
        href: "/dashboard/targets",
        help: {
          description:
            "Register a domain, URL, application, or other asset under a project. Record its environment and permission source, then define an approved scope.",
          example:
            "Add lab.example.test as a domain target and restrict the scope to the permitted assets, activities, and effective dates.",
          note: "Recording a target alone does not authorize platform activity.",
        },
      },
      {
        label: "Knowledge",
        href: "/dashboard/knowledge",
        help: {
          description:
            "Preserve source material and reusable research with provenance and review status. Reviewed documents can inform later investigation context.",
          example:
            "Save an assessment methodology with its source URL and date, review it, and relate a corrected document to the original.",
          note: "AI interpretations begin as drafts and need human review before becoming trusted references.",
        },
      },
      {
        label: "Tool imports",
        href: "/dashboard/imports",
        help: {
          description:
            "Upload supplied JSON, CSV, or SARIF results for review. Inspect the parsed records and their sources before adopting useful observations or finding drafts.",
          example:
            "Import a SARIF report from a tool you already ran in an authorized environment and review each relevant result.",
          note: "Importing data does not run a scanner or confirm its claims.",
        },
      },
      {
        label: "Remediation & outcomes",
        href: "/dashboard/remediation",
        help: {
          description:
            "Record remediation work, follow-up checks, and the outcome of a finding. Keep the retest record connected to the original claim and evidence.",
          example:
            "Document a proposed fix, record the human retest and supporting material, then update the outcome based on that review.",
        },
      },
      {
        label: "Background work",
        href: "/dashboard/tasks",
        help: {
          description:
            "Monitor recorded analytical jobs, including queued, running, completed, failed, and cancelled work. Inspect execution history before retrying an unsuccessful job.",
          example:
            "Check whether a delegated analysis is still queued or failed, then inspect its details to decide the next action.",
          note: "Queued work needs a running internal worker. These jobs reason over supplied material; they do not autonomously test targets.",
        },
      },
      {
        label: "Findings",
        href: "/dashboard/findings",
        help: {
          description:
            "Build reviewable claims with an affected asset, impact, severity rationale, and linked evidence. Record a human verification conclusion before reporting.",
          example:
            "Create a draft from an investigation, link approved supporting evidence, assess severity, and submit it for human review.",
          note: "AI suggestions and imported results cannot confirm a finding.",
        },
      },
      {
        label: "Evidence",
        href: "/dashboard/evidence",
        help: {
          description:
            "Store investigation-owned supporting material with its source, collection details, and review status. Link approved evidence to the claims it supports or contradicts.",
          example:
            "Upload a redacted request/response capture and explain when, where, and how it was collected.",
          note: "Evidence approval and AI-safe review are separate gates. Uploading a file does not automatically pass either gate.",
        },
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        help: {
          description:
            "Prepare investigation reports from reviewed findings using templates or a reviewable AI draft. Revisions preserve the report's history and source relationships.",
          example:
            "Select reportable findings, review the generated narrative, approve the revision, and export it for sharing.",
          note: "Human approval and source readiness remain required. The platform does not submit reports for you.",
        },
      },
    ],
  },
  {
    label: "Account",
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        help: {
          description:
            "Check your account details, personal workspace membership, and recorded activity. Use the account menu to manage your sign-in profile.",
          example:
            "Replay the workspace tour when you want a refresher on projects, evidence, AI assistance, and reporting.",
        },
      },
    ],
  },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;

  const projectSection = pathname.match(
    /^\/dashboard\/projects\/[^/]+\/(targets|investigations)(?:\/|$)/,
  )?.[1];
  if (projectSection) return item.href === "/dashboard/" + projectSection;

  return pathname === item.href || pathname.startsWith(item.href + "/");
}
