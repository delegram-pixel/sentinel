# V2 deployment and recovery operations

This runbook uses the existing Next.js application, PostgreSQL database and private evidence-storage adapters. The worker runs the same application code and database; no microservice, target scanner or external submission system is introduced.

## Multi-model rollout (ADR-034)

[Multi-model intelligence](../AI-MULTI-MODEL.md) documents the exact models, account/privacy requirements and routing configuration. Apply the three additive `20261111` AI migrations before updating both application and worker. Keep `AI_ROUTING_MODE=LEGACY` for existing Groq behavior, or enable `MULTI_MODEL` with configured provider credentials. Missing providers do not stop unrelated research. Collaboration is explicitly requested from Tasks and incomplete stages remain visible in investigation AI history.

Paid models require `AI_ALLOW_PAID_MODELS` and positive daily/job caps. Confirm provider privacy controls before enabling their attestations; paid Gemini requires acceptance of 55-day abuse-monitoring retention. OpenRouter requires contracted host slugs with native schema/ZDR support. Quotas are configured account limits, not free-tier guarantees. Correct rejected credentials, then reset the relevant `AIProviderQuota.disabled`, failure counter and cooldown before retrying. Uncertain delivery requires owner/admin ledger reconciliation; it never triggers automatic replay. `yarn ai:evaluate` performs offline deterministic checks without spending API credits.

## Production deployment

Production is deployed from GitHub Actions after the quality, integration and end-to-end jobs pass on `main` (ADR-032). The deploy job pulls the Vercel Production environment, applies `yarn db:deploy` with that environment's `DATABASE_URL` and `DIRECT_URL`, builds a prebuilt Vercel output, then promotes it. A failed migration stops promotion. Vercel Git deployments are disabled for `main` in `vercel.json`; preview branches use a separate Neon branch and Preview environment. The worker still runs outside Vercel.

## Database preparation

Use a disposable restored V1 database first. Inventory original record UUIDs/tenant relations, scope approvals/expiry, evidence keys/checksums and report revision Markdown hashes. Apply the production migration path to that restored copy, run the backfill twice, and reconcile the inventory. The automated preservation fixture does not replace this deployment rehearsal.

After configuring the intended environment's `DATABASE_URL` and Prisma migration connection, the existing commands are:

```sh
yarn db:validate
yarn db:status
yarn db:deploy
yarn db:generate
```

V2 migrations, in order:

1. `20261107010000_v2_research_foundation`
2. `20261107020000_v2_ai_reliability`
3. `20261107030000_v2_knowledge_execution`
4. `20261107040000_v2_agents_evidence`
5. `20261107050000_v2_imports_remediation`
6. `20261107060000_v2_usage_reconciliation`
7. `20261107070000_v2_storage_reporting`

Use migrations rather than `db push` or destructive resets. Production application behavior and migrations must be deployed as a compatible change; new writers require these additive tables/columns/constraints. Old readers may continue reading original records.

For each selected workspace:

```sh
yarn v2:backfill WORKSPACE_UUID
```

Replace `WORKSPACE_UUID` with the actual workspace UUID. The command emits project batch counts/cursors, without evidence content or credentials. It can safely restart from the beginning after interruption; existing mappings are reused. Draft legacy engagements need deliberate human review. ScopeVersion remains the authorization authority before and after mapping.

## Worker deployment

The production web application and worker need matching database and private-storage configuration, including the same `UPLOADTHING_TOKEN` and private UploadThing app. Local filesystem storage requires shared access when used locally; use the UploadThing adapter for deployments with separate hosts or ephemeral filesystems.

```sh
yarn worker
```

For an external scheduler using the same code and configuration:

```sh
yarn worker --once
```

`--once` claims at most one job per invocation. The continuously running worker polls when idle. SIGINT/SIGTERM stops further admission after the current job completes. A host supervisor must restart the process after a crash. A Next.js request, open SSE connection or Vercel build does not start a durable worker automatically.

Registered work: supplied-data AI analysis, reviewed knowledge indexing, bounded tool imports, evidence promotion and evidence cleanup. Queue status/cancellation is available at `/dashboard/tasks`; analytical outputs remain in their investigation's existing AI history.

Claims use two-minute leases with twenty-second heartbeats. Expired leases can be reclaimed, up to the stored maximum attempt count. A stale/cancelled worker cannot publish a task completion or change the job's final state. Inspect queue delay, failed jobs, lease expiry, uncertain token reservations and incomplete promotion/cleanup in routine operations.

## Provider operation and recovery

Set the existing `ANTHROPIC_API_KEY` and optional `AI_RESEARCH_MODEL` / `AI_SUMMARY_MODEL` configuration. Production missing credentials returns unavailable; it does not silently use mock output. Mock analysis remains a development/test facility. No additional provider or embedding credential is stored in the database by this implementation.

Every request/correction is recorded separately. A captured provider response can be revalidated and committed after interruption without another paid call. Explicit rate-limit/overload responses receive bounded queue backoff; retries create parent-linked task records with new context capture and budget reservation. Provider timeouts, malformed envelopes or uncertain interrupted calls retain uncertainty instead of assuming zero cost.

An owner/administrator can reconcile terminal uncertain usage at `/dashboard/tasks` using actual total billed input/output tokens, a provider-ledger reference and a human rationale. Captured usage is a minimum, and recently interrupted provider requests must settle before reconciliation. Do not release a reservation merely because a browser disconnected or a worker was restarted.

The normal guided chat still uses the request/SSE path with persisted task/attempt records. Its stable operation key prevents duplicate turns/model calls on replay. Durable job recovery applies to queued analytical work; request-bound chat interruptions require a deliberate new operation where no accepted result exists.

## Evidence recovery and retention

Human approval records a promotion intent before copying storage objects. The quarantined source remains until checksum-verified activation succeeds. A failed cleanup retries against the recorded original key without recopying accepted evidence. Cancellation blocks activation of a pending promotion. Do not delete a quarantine object manually to resolve a stuck job.

Reviewed replacement relationships preserve previous evidence and require approved sources from the same investigation. Replacement references do not silently rewrite existing finding/review/report associations. Evidence referenced by research decisions, relationships, assessments, verification history, reports, retests or AI snapshots cannot be physically deleted through the normal deletion flow.

Rejected/unreferenced evidence receives a persisted cleanup job. Review failed cleanup/promotion state and storage credentials; retry only when the object identity and recorded human decision remain valid. Privacy/account deletion and broader retention policy remain separate requirements and are not implemented by ad hoc object removal.

## Validation commands

```sh
yarn typecheck
yarn lint
yarn test --maxWorkers=1
yarn test:integration
yarn test:e2e
```

Integration tests read `TEST_DATABASE_URL` from `.env.test` or the process environment and apply migrations to that database. It must identify a disposable test database, never production. The integration test transaction helper rolls fixture writes back; the migration rehearsal uses a temporary schema and rolls it back.

When Turbopack's CSS-worker port binding is restricted by the execution environment, the existing browser configuration supports:

```sh
PLAYWRIGHT_WEBPACK=1 yarn test:e2e
```

This validates a production Webpack build. It does not establish that the default Turbopack compiler runs in that restricted environment. Signed-in browser checks need a saved Clerk development login through `CLERK_E2E_STORAGE_STATE`; guest-boundary checks are deliberately insufficient for signed-in acceptance.

## Rollback

Stop new queue admission and the worker if a deployed workflow fails. Preserve accepted outputs, attempts, reservations and object-operation identities. Prefer a forward application/schema correction or a compatible V1 reader deployment while retaining additive V2 data. Old UI paths cannot be assumed to maintain every new invariant after new V2 writes; rehearse any application rollback before use.

Do not delete additive tables or restore a pre-migration backup over new writes as an ordinary rollback. A disaster restore requires stopping writers and reconciling subsequent database/object changes. Retain original evidence versions and immutable approved report revisions throughout recovery.
