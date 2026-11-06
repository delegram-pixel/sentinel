import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { createEvidenceUploadIntent } from "@/modules/evidence/application/evidence-service";
import { evidenceIntentSchema } from "@/modules/evidence/domain/evidence";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

export async function POST(request: Request): Promise<Response> {
  const session = await getSessionContext();
  const payload = await request.json().catch(() => null);
  const parsed = evidenceIntentSchema.safeParse(payload);

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "The upload request is invalid." },
      { status: 400 },
    );
  }

  const result = await createEvidenceUploadIntent(
    new PrismaEvidenceStore(getDb()),
    createEvidenceStorage(),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    parsed.data,
  );

  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: 400 });
  }

  return Response.json(result.value);
}
