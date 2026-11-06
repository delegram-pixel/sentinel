import { getDb } from "@/lib/db";
import { getSessionContext } from "@/lib/session";
import { finalizeEvidenceUpload } from "@/modules/evidence/application/evidence-service";
import { PrismaEvidenceStore } from "@/modules/evidence/infrastructure/prisma-evidence-store";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
): Promise<Response> {
  const { evidenceId } = await params;
  const session = await getSessionContext();
  const result = await finalizeEvidenceUpload(
    new PrismaEvidenceStore(getDb()),
    createEvidenceStorage(),
    { userId: session.user.id, workspaceId: session.workspace.id, role: session.role },
    evidenceId,
  );

  if (!result.ok) {
    return Response.json({ error: result.message, code: result.code }, { status: 400 });
  }

  return Response.json(result.value);
}
