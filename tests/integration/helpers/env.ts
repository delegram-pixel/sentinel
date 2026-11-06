import { config } from "dotenv";
import { resolve } from "node:path";

// Local convenience: `.env.test` is gitignored. Existing environment
// variables (CI service configuration, shell overrides) always win.
config({ path: resolve(process.cwd(), ".env.test"), quiet: true });

const MISSING_MESSAGE = [
  "TEST_DATABASE_URL is not set.",
  "",
  "Integration tests require a disposable PostgreSQL 17 database. Either:",
  "  1. create .env.test with TEST_DATABASE_URL=<local postgres url>, or",
  "  2. export TEST_DATABASE_URL before running `yarn test:integration`.",
  "",
  "Never point TEST_DATABASE_URL at staging or production: the suite",
  "applies migrations and writes data.",
].join("\n");

export function requireTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim();

  if (!url) {
    throw new Error(MISSING_MESSAGE);
  }

  return url;
}
