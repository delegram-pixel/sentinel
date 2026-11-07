import "dotenv/config";
import { getDb } from "@/lib/db";
import { PrismaAIStore } from "@/modules/ai/infrastructure/prisma-ai-store";
import { createAIProvider, aiModelOverrides } from "@/modules/ai/infrastructure/provider-factory";
import { createEvidenceStorage } from "@/modules/evidence/infrastructure/storage-factory";
import { processNextResearchJob } from "@/modules/tasks/infrastructure/worker";
const db = getDb();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
const deps = {
  store: new PrismaAIStore(db),
  provider: createAIProvider(),
  evidenceStorage: createEvidenceStorage(),
  modelOverrides: aiModelOverrides(),
};
try {
  do {
    const processed = await processNextResearchJob(db, deps);
    if (process.argv.includes("--once")) break;
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopping);
} finally {
  await db.$disconnect();
}
