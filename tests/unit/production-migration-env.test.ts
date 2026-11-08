import { describe, expect, it } from "vitest";

import { createProductionMigrationEnv } from "../../scripts/production-migration-env.mjs";

const directUrl =
  "postgresql://owner:password@ep-example.us-east-2.aws.neon.tech/neondb?sslmode=require";

describe("production migration environment", () => {
  it("uses the GitHub direct connection when the pulled runtime URL is redacted", () => {
    const source = { DATABASE_URL: "[SENSITIVE]", DIRECT_URL: directUrl, PATH: "/usr/bin" };

    expect(createProductionMigrationEnv(source)).toEqual({
      ...source,
      DATABASE_URL: directUrl,
      DIRECT_URL: directUrl,
    });
    expect(source.DATABASE_URL).toBe("[SENSITIVE]");
  });

  it("uses the direct connection when DATABASE_URL is absent", () => {
    expect(createProductionMigrationEnv({ DIRECT_URL: directUrl }).DATABASE_URL).toBe(directUrl);
  });

  it("normalizes surrounding whitespace in the GitHub secret", () => {
    const env = createProductionMigrationEnv({ DIRECT_URL: ` \n${directUrl}\n ` });

    expect(env.DIRECT_URL).toBe(directUrl);
    expect(env.DATABASE_URL).toBe(directUrl);
  });

  it.each([undefined, "", " \t\n"])(
    "requires DIRECT_URL when it is %j even if DATABASE_URL is valid",
    (value) => {
      expect(() =>
        createProductionMigrationEnv({ DATABASE_URL: directUrl, DIRECT_URL: value }),
      ).toThrow(/DIRECT_URL is missing or blank.*GitHub Actions secret/);
    },
  );

  it("rejects a pooled Neon connection for migrations", () => {
    const pooledUrl = directUrl.replace("ep-example.", "ep-example-pooler.");

    expect(() => createProductionMigrationEnv({ DIRECT_URL: pooledUrl })).toThrow(
      /direct Neon connection/,
    );
  });

  it("identifies a redacted direct connection without falling back to DATABASE_URL", () => {
    expect(() =>
      createProductionMigrationEnv({ DIRECT_URL: "[SENSITIVE]", DATABASE_URL: directUrl }),
    ).toThrow(/redacted Vercel Secret placeholder/);
  });

  it("rejects malformed credentials without disclosing the connection", () => {
    const malformed = directUrl.replace("owner:password", "owner:pass?word");
    let error: unknown;
    try {
      createProductionMigrationEnv({ DIRECT_URL: malformed, DATABASE_URL: directUrl });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("DIRECT_URL");
    expect((error as Error).message).not.toContain(malformed);
    expect((error as Error).message).not.toContain("pass?word");
  });
});
