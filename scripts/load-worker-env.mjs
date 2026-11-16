import nextEnv from "@next/env";

// Queued AI jobs must use the same .env.local overrides as the Next.js app.
process.env.NODE_ENV ??= "development";
nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
