/**
 * @param {string | undefined} value
 * @param {string} variableName
 * @returns {string | undefined}
 */
export function parsePostgresUrl(value, variableName) {
  const normalized = value?.trim();
  if (!normalized) return undefined;

  const invalidUrl = () =>
    new Error(
      `${variableName} must be a raw PostgreSQL connection URL starting with postgresql:// or postgres:// and containing a host and database name. Do not include a psql command or literal surrounding quotes; percent-encode special characters in credentials.`,
    );

  let parsed;
  try {
    parsed = new URL(normalized);
  } catch {
    throw invalidUrl();
  }

  if (
    !/^(postgresql|postgres):\/\//.test(normalized) ||
    !parsed.hostname ||
    parsed.pathname.length <= 1 ||
    parsed.hash
  ) {
    throw invalidUrl();
  }

  return normalized;
}
