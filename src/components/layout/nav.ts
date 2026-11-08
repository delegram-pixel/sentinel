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
            "Start here to see what's been happening and what needs your attention. Pick up a recent investigation or follow a finding back to its evidence.",
          example:
            "Returning after a break? Open a recent investigation and check its saved next actions.",
        },
      },
      {
        label: "Research insights",
        href: "/dashboard/insights",
        help: {
          description:
            "See how your saved research is progressing. Use the counts to spot reviews waiting on you and fixes that still need a follow-up.",
          example: "Check the finding and remediation counts before deciding what to review next.",
          note: "These counts come from saved records. You'll still need to review the evidence to verify a vulnerability.",
        },
      },
      {
        label: "Projects",
        href: "/dashboard/projects",
        help: {
          description:
            "Give related research a home. Create a project first, then add its targets, investigations, and engagements as the work takes shape.",
          example:
            "For a practice app, create a Learning lab project, add one target, and open a separate investigation for each question.",
          note: "The project type explains the setting. Each target still needs its own active scope before testing.",
        },
      },
      {
        label: "Investigations",
        href: "/dashboard/investigations",
        help: {
          description:
            "Follow one research question here. Keep the clues, ideas, decisions, evidence, and AI conversations together so you can explain how you reached a conclusion.",
          example:
            "If a saved response seems to expose another account's data, record what supports that idea and what might rule it out.",
        },
      },
      {
        label: "Engagements",
        href: "/dashboard/engagements",
        help: {
          description:
            "Plan a round of work within a project. Write its objective, connect existing targets and scope versions, then update progress as you go.",
          example:
            "For a quarterly app review, create an engagement and connect the targets you'll be reviewing.",
          note: "Connecting a target or marking an engagement active doesn't grant testing permission. Check the target's scope too.",
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
            "Record the asset you want to research, its environment, and where your permission comes from. Then define and activate its scope before testing.",
          example:
            "Add lab.example.test, then set the allowed assets, activities, and dates to match your permission.",
          note: "Adding a target is the first step. Testing still needs an approved, active scope.",
        },
      },
      {
        label: "Knowledge",
        href: "/dashboard/knowledge",
        help: {
          description:
            "Keep useful references and lessons somewhere you can find them again. Save the source details, then have a human reviewer approve the material before using it in AI context.",
          example:
            "Save a methodology with its source URL and date. If you later find a correction, connect the new document to the original.",
          note: "AI interpretations start as drafts. A human reviewer needs to check them before they become trusted references.",
        },
      },
      {
        label: "Tool imports",
        href: "/dashboard/imports",
        help: {
          description:
            "Already have tool results? Upload a JSON, CSV, or SARIF export, check each record and its source, then adopt useful results as draft observations or findings.",
          example:
            "Upload a SARIF report from a tool you ran with permission, then review the results relevant to your investigation.",
          note: "An import brings in existing results. You'll still need to verify the tool's claims yourself.",
        },
      },
      {
        label: "Remediation & outcomes",
        href: "/dashboard/remediation",
        help: {
          description:
            "Keep track of what happened after a finding: the proposed fix, follow-up checks, and final outcome. Connect each retest to the original claim and evidence.",
          example:
            "Describe the fix, record an authorized manual retest with its evidence, then update the outcome based on what you found.",
        },
      },
      {
        label: "Background work",
        href: "/dashboard/tasks",
        help: {
          description:
            "Check whether analysis is queued, running, finished, failed, or cancelled. If something failed, read its history before deciding what to do next.",
          example:
            "Waiting on an analysis? Check its status, then open the results from its investigation when it's finished.",
          note: "Queued work waits for a worker to pick it up. Analysis uses saved material; it doesn't test targets on its own.",
        },
      },
      {
        label: "Findings",
        href: "/dashboard/findings",
        help: {
          description:
            "Explain what you found, which asset is affected, and why the impact matters. Link the evidence and ask a human reviewer to verify the claim before reporting it.",
          example:
            "Start a finding from an investigation, link approved evidence, explain the severity, and send it for human review.",
          note: "AI and tool results can help you investigate. A human reviewer must confirm the finding.",
        },
      },
      {
        label: "Evidence",
        href: "/dashboard/evidence",
        help: {
          description:
            "Save the material behind your research, along with where and how you collected it. After review, link approved evidence to the claims it supports or challenges.",
          example:
            "Upload a redacted request or response, and note when, where, and how you captured it.",
          note: "A reviewer must approve the evidence and separately check whether it's safe for AI. Uploading alone doesn't complete either review.",
        },
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        help: {
          description:
            "Turn reviewed findings into a write-up. Start with a template or an AI draft you can check, then save revisions to keep the report's history and sources together.",
          example:
            "Choose reportable findings, check the write-up and its sources, then get human approval before exporting.",
          note: "Export needs human approval and source records that are ready to use. Once exported, you submit the report yourself.",
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
            "Check your account, workspace membership, and activity history here. To change your sign-in profile, use the account menu above.",
          example: "Feeling a little lost? Replay the tour from Settings for a quick refresher.",
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
