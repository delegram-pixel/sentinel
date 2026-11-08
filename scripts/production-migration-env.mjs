import { parsePostgresUrl } from "./database-url.mjs";

/**
 * Use the GitHub production secret for migrations. Vercel exports Secret values
 * as [SENSITIVE], so its pulled environment cannot supply this connection.
 *
 * @param {Record<string, string | undefined>} source
 * @returns {Record<string, string | undefined>}
 */
export function createProductionMigrationEnv(source) {
  const directUrl = parsePostgresUrl(source.DIRECT_URL, "DIRECT_URL");
  if (!directUrl) {
    throw new Error(
      "DIRECT_URL is missing or blank. Add the raw direct Neon connection URL as a GitHub Actions secret in the production environment.",
    );
  }

  if (new URL(directUrl).hostname.includes("-pooler.")) {
    throw new Error(
      "DIRECT_URL must use the direct Neon connection, without -pooler. in its hostname.",
    );
  }

  // Both names are confined to the migration subprocess; runtime stays pooled.
  return { ...source, DATABASE_URL: directUrl, DIRECT_URL: directUrl };
}
