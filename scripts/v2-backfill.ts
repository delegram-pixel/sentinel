import "dotenv/config";
import { getDb } from "@/lib/db";
import { backfillLegacyWorkspace } from "@/modules/research/infrastructure/legacy-backfill";
import { z } from "zod";
const workspaceId = z.uuid().parse(process.argv[2]);
const db = getDb();
let cursor: string | undefined;
try {
  let more = true;
  while (more) {
    const batch = await backfillLegacyWorkspace(db, workspaceId, cursor);
    cursor = batch.cursor ?? undefined;
    more = batch.hasMore;
    console.log(JSON.stringify(batch));
  }
} finally {
  await db.$disconnect();
}
