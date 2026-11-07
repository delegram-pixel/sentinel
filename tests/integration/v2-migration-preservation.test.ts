import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { Client } from "pg";
import { expect, it } from "vitest";
import { requireTestDatabaseUrl } from "./helpers/env";

it("rehearses the additive migration against V1 rows and preserves all original table definitions and SQL invariants", async () => {
  const db = new Client({ connectionString: requireTestDatabaseUrl() });
  const schema = `rehearsal_${randomUUID().replaceAll("-", "")}`;
  await db.connect();
  try {
    await db.query("BEGIN");
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET LOCAL search_path TO "${schema}", public`);
    for (const migration of [
      "20261104024049_init",
      "20261106220000_evidence_file_name",
      "20261106230000_report_template_seed",
    ])
      await db.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
    const ids = Array.from({ length: 8 }, () => randomUUID());
    await db.query(
      'INSERT INTO "User" (id,"authProviderId",email,"displayName","updatedAt") VALUES ($1,$2,$3,$4,now())',
      [ids[0], `clerk-${ids[0]}`, `legacy-${ids[0]}@example.test`, "Legacy researcher"],
    );
    await db.query(
      'INSERT INTO "Workspace" (id,name,slug,"ownerId","updatedAt") VALUES ($1,$2,$3,$4,now())',
      [ids[1], "Legacy workspace", `legacy-${ids[1]}`, ids[0]],
    );
    await db.query(
      'INSERT INTO "WorkspaceMember" (id,"workspaceId","userId",role) VALUES ($1,$2,$3,$4)',
      [ids[2], ids[1], ids[0], "OWNER"],
    );
    await db.query(
      'INSERT INTO "Project" (id,"workspaceId","ownerId",name,slug,"updatedAt") VALUES ($1,$2,$3,$4,$5,now())',
      [ids[3], ids[1], ids[0], "Legacy project", `legacy-${ids[3]}`],
    );
    await db.query(
      'INSERT INTO "Target" (id,"projectId",name,"assetIdentifier","assetType","environmentType","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,now())',
      [ids[4], ids[3], "Legacy target", "lab.example.test", "DOMAIN", "PRACTICE_LAB"],
    );
    await db.query(
      'INSERT INTO "Investigation" (id,"workspaceId","projectId","targetId",title,"createdBy",status,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,now())',
      [ids[5], ids[1], ids[3], ids[4], "Legacy completed investigation", ids[0], "COMPLETED"],
    );
    await db.query(
      'INSERT INTO "Evidence" (id,"workspaceId","investigationId","evidenceType",title,"fileName","mimeType","fileSize",checksum,"storageKey","redactionStatus","uploadedBy","redactionReviewedBy","redactionReviewedAt","activatedAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,now(),now(),now())',
      [
        ids[6],
        ids[1],
        ids[5],
        "LOG",
        "Legacy reviewed log",
        "log.txt",
        "text/plain",
        20,
        "a".repeat(64),
        "immutable/legacy-log",
        "VERIFIED_SAFE",
        ids[0],
      ],
    );
    await db.query(
      'INSERT INTO "SessionSummary" (id,"investigationId",summary,"generatedByType","createdBy") VALUES ($1,$2,$3,$4,$5)',
      [ids[7], ids[5], "Human history survives", "HUMAN", ids[0]],
    );
    const columns = (
      await db.query<{ table_name: string; column_name: string }>(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name,ordinal_position",
        [schema],
      )
    ).rows;
    const tables = [...new Set(columns.map((c) => c.table_name))];
    expect(tables).toHaveLength(28);
    const originalIds: Record<string, string[]> = {};
    for (const table of tables)
      originalIds[table] = (await db.query(`SELECT id FROM "${table}" ORDER BY id`)).rows.map(
        (r) => r.id,
      );
    const manifest = async () => {
      const result: Record<string, string> = {};
      for (const table of tables) {
        const projection = columns
          .filter((c) => c.table_name === table)
          .map((c) => `"${c.column_name}"`)
          .join(",");
        const rows = (
          await db.query(
            `SELECT ${projection} FROM "${table}" WHERE id = ANY($1::uuid[]) ORDER BY id`,
            [originalIds[table]],
          )
        ).rows;
        result[table] = createHash("sha256").update(JSON.stringify(rows)).digest("hex");
      }
      return result;
    };
    const before = await manifest();
    const indexes = (
      await db.query<{ indexname: string; indexdef: string }>(
        "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=$1 ORDER BY indexname",
        [schema],
      )
    ).rows;
    for (const migration of (await readdir("prisma/migrations"))
      .filter((m) => /^20261107.*_v2_/.test(m))
      .sort()) {
      await db.query(await readFile(`prisma/migrations/${migration}/migration.sql`, "utf8"));
      expect(await manifest()).toEqual(before);
    }
    expect(await manifest()).toEqual(before);
    for (const index of indexes)
      expect(
        (
          await db.query("SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname=$2", [
            schema,
            index.indexname,
          ])
        ).rows[0]?.indexdef,
      ).toBe(index.indexdef);
    const legacy = (
      await db.query(
        'SELECT "uploadValidatedAt","collectedAt",collector FROM "Evidence" WHERE id=$1',
        [ids[6]],
      )
    ).rows[0];
    expect(legacy).toEqual({ uploadValidatedAt: null, collectedAt: null, collector: null });
    expect(
      (await db.query('SELECT status,"engagementId" FROM "Investigation" WHERE id=$1', [ids[5]]))
        .rows[0],
    ).toEqual({ status: "COMPLETED", engagementId: null });
  } finally {
    await db.query("ROLLBACK");
    await db.end();
  }
}, 60000);
