// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const loaderUrl = new URL("../../scripts/load-worker-env.mjs", import.meta.url).href;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function probeEnvironment(
  files: Record<string, string>,
  expected: { key: string; database: string },
  overrides: Record<string, string> = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "sentinel-worker-env-"));
  directories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(directory, name), contents);
  }
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
  for (const key of Object.keys(env)) {
    if (/^(AI_|GROQ_|__NEXT_)/.test(key) || ["DATABASE_URL", "DIRECT_URL"].includes(key)) {
      delete env[key];
    }
  }
  Object.assign(env, overrides);
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `await import(${JSON.stringify(loaderUrl)});
       console.log(JSON.stringify({
         keyMatches: process.env.GROQ_API_KEY === ${JSON.stringify(expected.key)},
         databaseMatches: process.env.DATABASE_URL === ${JSON.stringify(expected.database)},
         retentionEnabled: process.env.GROQ_ZDR_ENABLED === "true"
       }));`,
    ],
    { cwd: directory, env, encoding: "utf8" },
  );
  return JSON.parse(output.trim());
}

describe("background worker environment", () => {
  it("loads local AI and database overrides ahead of .env", () => {
    expect(
      probeEnvironment(
        {
          ".env":
            "GROQ_API_KEY=base-test-key\nGROQ_ZDR_ENABLED=false\nDATABASE_URL=base-test-database\n",
          ".env.local":
            "GROQ_API_KEY=local-test-key\nGROQ_ZDR_ENABLED=true\nDATABASE_URL=local-test-database\n",
        },
        { key: "local-test-key", database: "local-test-database" },
      ),
    ).toEqual({ keyMatches: true, databaseMatches: true, retentionEnabled: true });
  });

  it("uses production files while preserving process environment overrides", () => {
    expect(
      probeEnvironment(
        {
          ".env":
            "GROQ_API_KEY=base-test-key\nGROQ_ZDR_ENABLED=false\nDATABASE_URL=base-test-database\n",
          ".env.local":
            "GROQ_API_KEY=local-test-key\nGROQ_ZDR_ENABLED=false\nDATABASE_URL=local-test-database\n",
          ".env.production.local":
            "GROQ_API_KEY=production-test-key\nGROQ_ZDR_ENABLED=true\nDATABASE_URL=production-test-database\n",
        },
        { key: "process-test-key", database: "production-test-database" },
        { NODE_ENV: "production", GROQ_API_KEY: "process-test-key" },
      ),
    ).toEqual({ keyMatches: true, databaseMatches: true, retentionEnabled: true });
  });
});
