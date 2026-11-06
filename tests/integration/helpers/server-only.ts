/**
 * Integration tests run in a plain Node process, not a React Server Component
 * environment, so the `server-only` marker package would throw on import.
 * Alias it to an empty module: the boundary is enforced by Next.js builds and
 * does not change database behaviour under test.
 */
export {};
