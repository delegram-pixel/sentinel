// Prisma CLI configuration.
//
// Runtime queries use the pooled Neon connection (`DATABASE_URL`) through the
// Prisma driver adapter. Migration and introspection commands use the direct
// connection (`DIRECT_URL`) because pooling proxies cannot hold the session
// state that migrations require. See docs/DECISIONS.md ADR-018.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { parsePostgresUrl } from "./scripts/database-url.mjs";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      parsePostgresUrl(process.env["DIRECT_URL"], "DIRECT_URL") ??
      parsePostgresUrl(process.env["DATABASE_URL"], "DATABASE_URL"),
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
  },
});
