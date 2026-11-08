import { MetadataList } from "@/components/shared/metadata-list";
import { ResearchSection } from "@/components/shared/research-section";
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionContext } from "@/modules/auth/application/ports";
import { ReplayWorkspaceTourButton } from "@/components/onboarding/workspace-tour-provider";

export function SettingsDetails({ session }: { session: SessionContext }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
      <ResearchSection
        id="account"
        title="Account"
        description="Check which account you're signed in with."
      >
        <MetadataList
          items={[
            { label: "Display name", value: session.user.displayName },
            { label: "Email address", value: session.user.email },
          ]}
        />
        <p className="mt-6 text-xs leading-relaxed text-text-secondary">
          To update your profile or sign out, open the account menu in the header.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <ReplayWorkspaceTourButton />
          <p className="text-xs text-text-secondary">
            Take a quick tour of the research workflow and where everything lives.
          </p>
        </div>
      </ResearchSection>
      <ResearchSection
        id="workspace"
        title="Workspace"
        description="This is the personal workspace linked to your account."
      >
        <MetadataList
          className="sm:grid-cols-2"
          items={[
            { label: "Name", value: session.workspace.name },
            { label: "Workspace type", value: "Personal" },
            {
              label: "Your membership",
              value: session.role.charAt(0) + session.role.slice(1).toLowerCase(),
            },
            { label: "Workspace ID", value: session.workspace.id, technical: true },
          ]}
        />
        <p className="mt-6 text-xs leading-relaxed text-text-secondary">
          The projects, research, and activity you save live in this workspace.
        </p>
      </ResearchSection>
    </div>
  );
}

export function SettingsDetailsSkeleton() {
  return (
    <div role="status" aria-label="Loading account and workspace details">
      <span className="sr-only">Loading account and workspace details…</span>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" aria-hidden>
        {[0, 1].map((index) => (
          <div key={index} className="flex flex-col gap-5 border-t border-border pt-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-5 w-56 max-w-full" />
            <Skeleton className="h-5 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
