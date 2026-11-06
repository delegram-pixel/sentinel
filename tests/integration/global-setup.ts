import { execFileSync } from "node:child_process";

import { requireTestDatabaseUrl } from "./helpers/env";

/**
 * Apply every pending migration to the test database before the suite runs.
 * `prisma migrate deploy` is the production migration path, so CI exercises
 * the same command that deployment uses.
 */
export default function setup(): void {
  const url = requireTestDatabaseUrl();

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      DIRECT_URL: url,
    },
  });
}
