# SENTINEL RESEARCH
# Engineering Guide

**Status:** Applies from the foundation slice onward.
**Audience:** Engineers and AI coding agents working in this repository.

---

## 1. Source of truth

When documents disagree, resolve in this order:

1. `docs/DECISIONS.md` — accepted ADRs. These override older prose.
2. `docs/PRD.md` — product intent and acceptance criteria.
3. `docs/TECHNICAL-ARCHITECTURE.md` and `docs/DATABASE-SCHEMA.md` — structural design.
4. `docs/TECHNICAL-REQUIREMENTS.md`, `docs/AI-ARCHITECTURE.md`, `docs/APP-FLOW.md` — detail.
5. `docs/IMPLEMENTATION-PLAN.md` — sequencing.

Do not silently edit a source document to match code. Record a new ADR, then amend the document with
a version bump.

---

## 2. Local setup

```bash
yarn install
cp .env.example .env.local
yarn dev
```

- Node.js 22 and Yarn 1.22.22 are the supported toolchain.
- `.env.local` is not committed. `.env.example` lists the contract but contains no secrets.
- Every environment variable is validated by `src/config/env.schema.ts`.
- Server code reads secrets through `getServerEnv()` in `src/config/env.server.ts`. Client code may
  only use `NEXT_PUBLIC_*` values from `src/config/env.client.ts`.

Production startup calls `assertProductionEnv()` and fails if required values are missing. Builds and
tests must not require production secrets.

### Local database

The schema and migrations are real. A local PostgreSQL 17 instance is enough:

```bash
podman run -d --name sentinel-pg \
  -e POSTGRES_USER=sentinel -e POSTGRES_PASSWORD=sentinel \
  -e POSTGRES_DB=sentinel_dev -p 5433:5432 postgres:17-alpine

export DATABASE_URL=postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_dev
export DIRECT_URL=$DATABASE_URL
yarn db:migrate
yarn db:generate
```

`DATABASE_URL` is the pooled runtime connection; `DIRECT_URL` is used only for migrations
(ADR-018). Never run `prisma migrate dev` against a deployed database.

Integration tests use a separate database. Create it once, then add `.env.test` (gitignored):

```bash
podman exec sentinel-pg createdb -U sentinel sentinel_test
printf 'TEST_DATABASE_URL=postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_test\n' > .env.test
yarn test:integration
```

---

## 3. Commands

| Command                | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| `yarn dev`             | Development server                             |
| `yarn build`           | Production build                               |
| `yarn db:generate`     | Generate the Prisma client                     |
| `yarn db:validate`     | Validate `prisma/schema.prisma`                |
| `yarn db:migrate`      | Create and apply a development migration       |
| `yarn db:deploy`       | Apply migrations (deployment and CI path)      |
| `yarn db:status`       | Show migration status                          |
| `yarn db:studio`       | Open Prisma Studio                             |
| `yarn lint`            | ESLint                                         |
| `yarn typecheck`       | `tsc --noEmit`                                 |
| `yarn test`            | Vitest unit tests                              |
| `yarn test:watch`      | Vitest in watch mode                           |
| `yarn test:integration`| PostgreSQL integration tests                   |
| `yarn test:e2e`        | Playwright against a production build          |
| `yarn format`          | Prettier write                                 |
| `yarn format:check`    | Prettier check                                 |

Definition of done for any change:

```bash
yarn format:check && yarn lint && yarn typecheck && yarn test && yarn build
```

Run `yarn test:integration` for schema, migration, or repository changes. Run `yarn test:e2e` for
changes that affect routing or the application shell.

---

## 4. Module structure

```text
src/modules/<module>/
  domain/          Pure types, schemas, guards, and invariants
  application/     Use cases and orchestration (added with the module)
  infrastructure/  Prisma, storage, providers, external systems
  presentation/    Server Actions, route handlers, components
```

Rules:

1. `domain/` imports only TypeScript and Zod. No React, Next.js, Prisma, or provider SDKs.
2. `application/` may import `domain/` and repository interfaces, never concrete infrastructure.
3. `infrastructure/` implements interfaces and may import Prisma or SDKs.
4. `presentation/` parses input, authenticates, delegates, and maps errors. It contains no business
   rules.
5. Cross-module imports go through a module's public entry point, not its internals.
6. A module never reads another module's tables directly. Use a service or repository contract.

---

## 5. Domain rules

### 5.1 Statuses and transitions

`src/modules/findings/domain/finding-status.ts`,
`src/modules/hypotheses/domain/hypothesis-status.ts`, and
`src/modules/ai/domain/ai-task-status.ts` are the only definitions of their respective statuses.

- Persistence and UI must call the transition guards. Do not re-implement rules in conditions,
  database enums alone, or UI state.
- Adding a status requires an ADR, a transition matrix update, and tests for every allowed and
  disallowed edge.
- Terminal states are terminal. Retrying an AI task creates a new task; it does not revive one.
- Lifecycle stages are `AITaskEvent` records, not task statuses.

### 5.2 Verification

`src/modules/verification/domain/verification-conclusion.ts` separates AI and human conclusions.

- AI may use `REVIEW_SUPPORTS_CONFIRMATION`; it may never use `CONFIRMED`.
- Only a human review can produce `CONFIRMED` or `REJECTED`.
- Any transition to `CONFIRMED` or `REPORTABLE` records the approving user in the audit log.

### 5.3 Capabilities

`src/modules/security/domain/capability.ts` is the single capability gate.

- Every AI task must resolve its required capabilities before the provider call.
- Unknown capabilities are denied.
- `NOT_IMPLEMENTED` and `PROHIBITED` capabilities cannot be enabled by configuration.
- Adding a capability requires an ADR, a scope rule, a threat-model update, and security tests.

### 5.4 Ownership

`src/modules/workspaces/domain/ownership.ts` is the access guard.

- `Workspace` is the sole tenancy root.
- Resolve the workspace server-side and verify membership. Never trust a workspace ID from the
  client.
- Every workspace-owned row carries a workspace ID; cross-workspace reads and writes are rejected.
- The active `ScopeVersion` is the authorization authority. Target status is derived, not editable.

---

## 6. Environment and configuration

- Add a variable to `src/config/env.schema.ts`, `.env.example`, and the relevant entry point.
- Never import `env.server.ts` from a client component. It imports `server-only`.
- Never log secrets, tokens, raw evidence, or provider payloads.
- Never read `process.env` outside `src/config/`.

---

## 7. Data access (from Phase 2)

- Prisma is the only database client. Import the singleton from `src/lib/db.ts`, never construct a
  client in a route or component.
- The schema lives in `prisma/schema.prisma`. Generated code lives in `src/generated/prisma` and is
  never edited or committed.
- `DATABASE_URL` is the pooled runtime URL. `DIRECT_URL` is for migrations only (ADR-018).
- Constraints that Prisma cannot express live in migration SQL and are traceable to an ADR.
- All queries are scoped by workspace. A repository method that cannot enforce scope must not exist.
- Services validate input with Zod at the boundary and re-check authorization before mutation.
- Mutations that span tables use a transaction.
- Soft delete is the default for research records. Hard deletion belongs to a privileged retention
  job.
- Evidence content is immutable. Corrections create a new version with `supersedesId`.
- No query returns unused sensitive fields; select explicitly.

---

## 8. API and mutation strategy

Per ADR-009:

- **Server Actions** for first-party UI mutations.
- **Route Handlers** only for Clerk webhooks, AI streaming, task polling, evidence upload
  intent/finalize, report export, and a future public API.
- One canonical path per operation. Never implement both an action and a route for the same
  mutation.
- Actions and routes share the service layer, Zod schemas, authorization guard, and audit call.
- Return typed results from actions. Do not throw raw errors into the client.
- Never expose stack traces, provider messages, or internal identifiers in error responses.

---

## 9. Error handling

Use the shared result type in `src/modules/shared/domain/result.ts` for expected domain failures.

- Expected failures are typed and mapped to user-safe messages.
- Unexpected failures are logged server-side with a correlation ID and returned as a generic error.
- Authorization denials are audit-logged even when no state changes.
- Do not catch and ignore errors. Do not surface a success when a side effect failed.

---

## 10. Testing

- Unit tests live in `tests/unit/` and cover domain rules and pure functions.
- Integration tests live in `tests/integration/` and run against a real PostgreSQL 17 database via
  `TEST_DATABASE_URL`. Each test rolls back its transaction (ADR-021).
- End-to-end tests live in `tests/e2e/` and cover navigation and shell behaviour against a
  production build.
- Every transition guard must test all allowed edges and a representative set of forbidden ones.
- Security tests must prove denial, not only success.
- Tests must not depend on production secrets, a live network target, or a real AI call.
- Mock at the boundary (provider, storage, clock), not by weakening the code under test.
- A bug fix includes a regression test.

Run a single file with:

```bash
yarn test tests/unit/finding-status.test.ts
```

---

## 11. UI conventions

- Use design tokens from `src/app/globals.css`. Do not hard-code hex colours in components.
- Use shadcn/ui primitives in `src/components/ui/`; extend variants rather than copying markup.
- Status colours always include a text label. Colour is never the only signal.
- Distinguish AI suggestions, human observations, verified evidence, and approved conclusions
  visually and textually.
- Empty states must say what is missing. Never show fake metrics or sample findings outside a
  clearly labelled demo context.
- Every interactive control is keyboard reachable and has an accessible name.
- Support `prefers-reduced-motion`; do not rely on animation to convey state.

---

## 12. Security guardrails

- Never add a capability that touches a network target without an ADR, scope checks, SSRF controls,
  rate limiting, and audit logging.
- Never let AI set `CONFIRMED`, `REPORTABLE`, scope, or approval state.
- Never store provider credentials in the database or expose them to the browser.
- Webhooks verify signatures and are idempotent.
- Uploads are validated server-side for type, size, and ownership before a presigned URL is issued.
- Downloads use short-lived signed URLs after an ownership check.
- Audit rows are append-only from application code.

---

## 13. Git and review

- Keep commits focused. Do not mix refactors with behaviour changes.
- A change that alters a decision updates `docs/DECISIONS.md`.
- A change that adds a dependency explains why in the pull request.
- Do not commit `.env` files, secrets, generated reports, or build output.
- The default branch is `main`; CI must pass before merge.

---

## 14. Current phase boundaries

Implemented: shell, tokens, environment contract, and domain contracts.

Not implemented, by design:

- Prisma, migrations, and repositories
- Clerk and workspace provisioning
- AI provider calls, prompts, and streaming
- Evidence upload and object storage
- Report rendering and export

Before starting any of these, confirm the relevant decisions in `docs/DECISIONS.md` and resolve the
open schema, platform, or AI decisions listed in `docs/DEVELOPMENT-READINESS-REPORT.md`.
