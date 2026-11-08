import { describe, expect, it } from "vitest";

import { parsePostgresUrl } from "../../scripts/database-url.mjs";

describe("Prisma database URL configuration", () => {
  it.each([undefined, "", " \t\n"])("treats %j as absent", (value) => {
    expect(parsePostgresUrl(value, "DIRECT_URL")).toBeUndefined();
  });

  it.each(["postgresql", "postgres"])("accepts raw %s URLs with encoded credentials", (scheme) => {
    const value = `${scheme}://user:p%40ss%23word@localhost:5432/sentinel?sslmode=require`;

    expect(parsePostgresUrl(value, "DIRECT_URL")).toBe(value);
  });

  it("trims surrounding whitespace without changing the connection string", () => {
    const value = "postgresql://user:pass@localhost/sentinel";

    expect(parsePostgresUrl(` \n${value}\n `, "DIRECT_URL")).toBe(value);
  });

  it.each([
    "psql 'postgresql://user:secret@localhost/sentinel'",
    '"postgresql://user:secret@localhost/sentinel"',
    'DATABASE_URL="postgresql://user:secret@localhost/sentinel"',
    "postgresql://localhost/",
    "postgresql:///sentinel",
    "https://localhost/sentinel",
    "prisma://localhost/sentinel?api_key=secret",
    "secret://localhost/sentinel",
    "$DATABASE_URL",
    "postgresql://localhost/sentinel#secret",
    "postgresql://user:sec#ret@localhost/sentinel",
  ])("rejects malformed connection strings (%j) with a credential-free error", (value) => {
    let error: unknown;
    try {
      parsePostgresUrl(value, "DIRECT_URL");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain("DIRECT_URL");
    expect(message).toContain("postgresql:// or postgres://");
    expect(message).not.toContain(value);
    expect(message).not.toContain("secret");
  });

  it.each([
    ['DATABASE_URL="postgresql://user:secret@localhost/sentinel"', /environment assignment/],
    ["DIRECT_URL=postgresql://user:secret@localhost/sentinel", /environment assignment/],
    ["export DATABASE_URL=postgresql://user:secret@localhost/sentinel", /environment assignment/],
    ['"postgresql://user:secret@localhost/sentinel"', /quote character/],
    ["psql 'postgresql://user:secret@localhost/sentinel'", /psql command/],
    ["https://user:secret@localhost/sentinel", /URL scheme is not postgresql or postgres/],
    ["postgresql://localhost/", /database name is missing/],
    ["postgresql://user:secret@localhost/sentinel#fragment", /unencoded #/],
    ["postgresql://user:sec#ret@localhost/sentinel", /unencoded #/],
    ["postgresql://localhost/sentinel#", /unencoded #/],
  ])("explains why %j is rejected without echoing it", (value, reason) => {
    let error: unknown;
    try {
      parsePostgresUrl(value, "DATABASE_URL");
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(reason);
    expect((error as Error).message).not.toContain(value);
    expect((error as Error).message).not.toContain("secret");
  });
});
