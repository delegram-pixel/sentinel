// Version 1 belongs to the deferred questionnaire (ADR-023). Only users
// provisioned with this version are automatically offered the workspace tour.
export const WORKSPACE_TOUR_VERSION = 2;

export type WorkspaceTourProgress = {
  onboardingVersion: number;
  onboardingCompletedAt: Date | null;
};

export type DismissWorkspaceTourResult = { ok: true } | { ok: false; message: string };

export function shouldShowWorkspaceTour(progress: WorkspaceTourProgress | null): boolean {
  return (
    progress?.onboardingVersion === WORKSPACE_TOUR_VERSION &&
    progress.onboardingCompletedAt === null
  );
}
