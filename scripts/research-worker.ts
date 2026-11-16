import "./load-worker-env.mjs";
import { getDb } from "@/lib/db";
import { createAiDependencies } from "@/modules/ai/infrastructure/ai-dependencies";
import { processNextResearchJob } from "@/modules/tasks/infrastructure/worker";
import { runWorkerLoop } from "@/modules/tasks/application/worker-loop";
const db = getDb();
let stopping = false;
process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});
const deps = createAiDependencies(db);
const once = process.argv.includes("--once");
try {
  await runWorkerLoop({
    processNext: () => processNextResearchJob(db, deps),
    shouldStop: () => stopping,
    once,
    onError(error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "WORKER_PROCESSING_ERROR";
      console.error(
        JSON.stringify({
          event: "RESEARCH_WORKER_ERROR",
          code: /^[A-Z0-9_]{1,64}$/.test(code) ? code : "WORKER_PROCESSING_ERROR",
          retrying: !once,
        }),
      );
    },
  });
} catch {
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
