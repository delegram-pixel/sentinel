export type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
};

export type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Dashboard", href: "/dashboard", exact: true },
      { label: "Projects", href: "/dashboard/projects" },
      { label: "Investigations", href: "/dashboard/investigations" },
    ],
  },
  {
    label: "Research",
    items: [
      { label: "Targets", href: "/dashboard/targets" },
      { label: "Findings", href: "/dashboard/findings" },
      { label: "Evidence", href: "/dashboard/evidence" },
      { label: "Reports", href: "/dashboard/reports" },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Settings", href: "/dashboard/settings" }],
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
