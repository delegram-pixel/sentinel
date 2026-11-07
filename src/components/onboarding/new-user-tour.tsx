import { AutomaticWorkspaceTour } from "@/components/onboarding/workspace-tour-provider";
import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { shouldShowWorkspaceTour } from "@/modules/auth/domain/workspace-tour";
import { PrismaWorkspaceTourStore } from "@/modules/auth/infrastructure/prisma-workspace-tour-store";

export async function NewUserTour() {
  const session = await getSessionContext();
  const progress = await new PrismaWorkspaceTourStore(getDb()).readProgress(session.user.id);
  return shouldShowWorkspaceTour(progress) ? <AutomaticWorkspaceTour /> : null;
}
