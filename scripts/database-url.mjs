/**
 * @param {string | undefined} value
 * @param {string} variableName
 * @returns {string | undefined}
 */
export function parsePostgresUrl(value, variableName) {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  // The reason is appended to the generic message so CI logs explain what is
  // wrong without ever printing the (secret) value.
  const invalidUrl = (reason) =>
    new Error(
      `${variableName} must be a raw PostgreSQL connection URL starting with postgresql:// or postgres:// and containing a host and database name. Do not include a psql command or literal surrounding quotes; percent-encode special characters in credentials.${reason ? ` Detected: ${reason}.` : ""}`,
    );

  if (normalized === "[SENSITIVE]") {
    throw invalidUrl("the value is a redacted Vercel Secret placeholder");
  }

  if (/^(?:export\s+)?[a-zA-Z_][a-zA-Z0-9_]*\s*=/.test(normalized)) {
    throw invalidUrl(
      "the value is an environment assignment; paste only the URL after =, without wrapping quotes",
    );
  }

  if (/^["']/.test(normalized) || /["']$/.test(normalized)) {
    throw invalidUrl("the value starts or ends with a quote character");
  }

  if (/^psql\b/i.test(normalized)) {
    throw invalidUrl("the value starts with a psql command");
  }

  if (/\s/.test(normalized)) {
    throw invalidUrl("the value contains whitespace");
  }

  // A # in credentials can make URL parsing fail before a fragment is available.
  if (normalized.includes("#")) {
    throw invalidUrl("the value contains an unencoded # (fragment); percent-encode it");
  }

  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//.exec(normalized)?.[1];
  if (scheme && !/^postgres(ql)?$/i.test(scheme)) {
    throw invalidUrl("the URL scheme is not postgresql or postgres");
  }

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw invalidUrl(
      "the value is not a parseable URL (check for an invalid port or unencoded special characters)",
    );
  }

  if (!/^(postgresql|postgres):\/\//.test(normalized)) {
    throw invalidUrl("the value does not start with postgresql:// or postgres://");
  }

  if (!parsed.hostname) {
    throw invalidUrl("the host is missing");
  }

  if (parsed.pathname.length <= 1) {
    throw invalidUrl("the database name is missing after the host");
  }

  return normalized;
}

/**
 * Prisma client generation does not require a datasource URL. Treat a redacted
 * Vercel Secret as unavailable; database commands still require a real URL.
 *
 * @param {Record<string, string | undefined>} source
 * @returns {string | undefined}
 */
export function resolvePrismaDatasourceUrl(source) {
  const directUrl = source.DIRECT_URL?.trim();
  const variableName = directUrl ? "DIRECT_URL" : "DATABASE_URL";
  const value = directUrl || source.DATABASE_URL?.trim();

  if (value === "[SENSITIVE]") return undefined;

  return parsePostgresUrl(value, variableName);
}
