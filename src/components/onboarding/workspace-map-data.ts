import { isNavItemActive, NAV_GROUPS } from "@/components/layout/nav";

type MapDestination = {
  href: string;
  hint: string;
};

export type WorkspaceMapStage = MapDestination & {
  id: string;
  name: string;
  branches: readonly MapDestination[];
  note?: string;
};

export const WORKSPACE_MAP_STAGES: readonly WorkspaceMapStage[] = [
  {
    id: "plan",
    name: "Plan",
    href: "/dashboard/projects",
    hint: "Give related research a home.",
    branches: [
      { href: "/dashboard/targets", hint: "Record assets, permission, and scope." },
      { href: "/dashboard/engagements", hint: "Group a round of work around an objective." },
    ],
  },
  {
    id: "investigate",
    name: "Investigate",
    href: "/dashboard/investigations",
    hint: "Follow a question and save the clues.",
    branches: [
      { href: "/dashboard/evidence", hint: "Keep the proof and its source." },
      { href: "/dashboard/imports", hint: "Bring in tool results for review." },
      { href: "/dashboard/knowledge", hint: "Save references and lessons for later." },
    ],
  },
  {
    id: "verify",
    name: "Verify",
    href: "/dashboard/findings",
    hint: "Build a claim the evidence supports.",
    branches: [],
    note: "A human reviewer checks the evidence and confirms the finding.",
  },
  {
    id: "share",
    name: "Share",
    href: "/dashboard/reports",
    hint: "Turn reviewed findings into a write-up.",
    branches: [],
    note: "Save a revision and get human approval before exporting.",
  },
  {
    id: "follow-up",
    name: "Follow up",
    href: "/dashboard/remediation",
    hint: "Track fixes, retests, and outcomes.",
    branches: [],
    note: "Keep the outcome with the finding. Save useful lessons in Knowledge.",
  },
];

export const WORKSPACE_MAP_UTILITIES: readonly MapDestination[] = [
  { href: "/dashboard/tasks", hint: "Check queued work and analysis." },
  { href: "/dashboard/insights", hint: "See progress and review gaps." },
  { href: "/dashboard", hint: "Return to your research overview." },
  { href: "/dashboard/settings", hint: "Your account, history, and tour." },
];

const navigationItems = NAV_GROUPS.flatMap((group) => group.items);

export function getWorkspaceMapItem(href: string) {
  return navigationItems.find((item) => item.href === href);
}

export function isWorkspaceMapDestinationActive(pathname: string, href: string): boolean {
  const item = getWorkspaceMapItem(href);
  return item ? isNavItemActive(pathname, item) : false;
}
