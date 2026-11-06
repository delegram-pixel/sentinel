import "server-only";

import { parseServerEnv, type ServerEnv } from "@/config/env.schema";

let cached: ServerEnv | undefined;

/**
 * Server-only environment accessor. Do not import this from a client
 * component. Validation is lazy so a build or test does not require real
 * secrets.
 */
export function getServerEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
