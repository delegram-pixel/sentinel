import "dotenv/config";
import { getDb } from "@/lib/db";
import { createAiDependencies } from "@/modules/ai/infrastructure/ai-dependencies";
import { processNextResearchJob } from "@/modules/tasks/infrastructure/worker";
const db = getDb();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
const deps = createAiDependencies(db);
try {
  do {
    const processed = await processNextResearchJob(db, deps);
    if (process.argv.includes("--once")) break;
    if (!processed) await new Promise((resolve) => setTimeout(resolve, 1000));
  } while (!stopping);
} finally {
  await db.$disconnect();
}
