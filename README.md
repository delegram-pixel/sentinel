# Sentinel Research

A security research workspace for scoped investigations, evidence-backed findings, and
human-verified conclusions.

> **Status: Phase 3 in progress — projects, targets, and scope.** The foundation and data layer
> exist. Clerk authentication, personal-workspace provisioning, Dashboard, and Settings are
> connected. Dashboard shows real workspace counts and the five newest audit events; Settings
> shows the authenticated profile, membership, and the newest 20 workspace audit events.
> Project screens are connected. Target and scope interface work continues in Phase 3.
> AI integration and evidence storage are still unimplemented. Nothing in this build can contact
> a real target. See the [current checkpoint](docs/PROJECT-STATUS.md).

## Requirements

- Node.js 22
- Yarn 1.22.22

## Local setup

```bash
yarn install
cp .env.example .env.local
yarn dev
```

Open <http://localhost:3000>. The authenticated workspace is at `/dashboard`; account, workspace,
membership, and audit details are at `/dashboard/settings`.

Every variable in `.env.example` is optional in development. Production requires the values listed
in `src/config/env.schema.ts`; the server refuses to start without them.

Clerk keys and a migrated database are required for the signed-in Dashboard and Settings. The
authentication setup notice and public landing page can render without them. The database setup is:

```bash
# PostgreSQL 17, or any local instance
export DATABASE_URL=postgresql://sentinel:sentinel@127.0.0.1:5433/sentinel_dev
export DIRECT_URL=$DATABASE_URL
yarn db:migrate
yarn db:generate
```

`DATABASE_URL` is pooled at runtime; `DIRECT_URL` is used only for migrations (ADR-018). Integration
tests use a separate database through `TEST_DATABASE_URL`; see
[`docs/ENGINEERING.md`](docs/ENGINEERING.md) for the full procedure.

## Commands

| Command                 | Purpose                                   |
| ----------------------- | ----------------------------------------- |
| `yarn dev`              | Start the development server              |
| `yarn build`            | Create a production build                 |
| `yarn start`            | Serve the production build                |
| `yarn lint`             | Run ESLint                                |
| `yarn typecheck`        | Run TypeScript with no emit               |
| `yarn test`             | Run unit tests once                       |
| `yarn test:watch`       | Run unit tests in watch mode              |
| `yarn test:integration` | Run PostgreSQL integration tests          |
| `yarn test:e2e`         | Run Playwright against a production build |
| `yarn db:generate`      | Generate the Prisma client                |
| `yarn db:validate`      | Validate the Prisma schema                |
| `yarn db:migrate`       | Create and apply a development migration  |
| `yarn db:deploy`        | Apply migrations (deployment and CI)      |
| `yarn db:status`        | Show migration status                     |
| `yarn db:studio`        | Open Prisma Studio                        |
| `yarn format`           | Format with Prettier                      |
| `yarn format:check`     | Verify formatting without writing         |

Before opening a pull request, run `yarn format:check && yarn lint && yarn typecheck && yarn test`.
CI runs the same checks plus a production build, PostgreSQL integration tests, and the end-to-end
suite.

Playwright starts a separate production server at <http://localhost:3100> and loads environment
variables with Next.js's environment loader. With Clerk development keys configured, the official
`@clerk/testing` setup provides a testing token for guest redirects and auth form checks (ADR-021).
Without keys, the suite checks the public landing page and authentication configuration notices.
CI reads development keys from `CLERK_TEST_PUBLISHABLE_KEY` and `CLERK_TEST_SECRET_KEY` secrets.

Signed-in dashboard, Settings, and navigation checks require a saved Playwright storage state from
a dedicated Clerk development account signed in at that origin. Save it under `playwright/.auth/`
(gitignored) and select it with `CLERK_E2E_STORAGE_STATE=playwright/.auth/clerk.json`. Those checks
are explicitly skipped when no fixture is supplied. The application always uses Clerk authentication.

Where the native Turbopack compiler cannot run, `PLAYWRIGHT_WEBPACK=1 yarn test:e2e` selects Webpack
for the browser suite's production build. The default application build remains Turbopack.

## Deployment (Vercel)

Production deploys run through GitHub Actions after the `quality`, `integration`, and `e2e` jobs
pass on `main`. The deploy job pulls the Vercel production environment, applies `yarn db:deploy`
against the production Neon database, builds a prebuilt Vercel output, and deploys it. A failed
migration stops the deployment before any new application version is released. The workflow can also
be started manually with **Actions → CI → Run workflow** on `main`.

`vercel.json` disables Git-triggered deployments for `main` so production is owned by the workflow.
Other branches may still use Vercel preview deployments through the Git integration.

### Vercel project setup

1. Import `delegram-pixel/sentinel` into Vercel and keep the repository root as the project root.
2. Add every variable from `.env.example` to the Vercel **Production** environment. `DATABASE_URL`
   must be the pooled Neon connection and `DIRECT_URL` the direct Neon connection (ADR-018).
3. Configure the Vercel **Preview** environment with a separate Neon branch or database. Preview
   deployments must never use production database, storage, or AI credentials.
4. Add these repository or `production` environment secrets in GitHub:
   - `VERCEL_TOKEN`
   - `VERCEL_ORG_ID`
   - `VERCEL_PROJECT_ID`

After `vercel link`, both IDs are available in `.vercel/project.json`.

Create `VERCEL_TOKEN` in [Vercel account settings → Tokens](https://vercel.com/account/settings/tokens),
then save its value as a GitHub Actions secret named exactly `VERCEL_TOKEN` in
[repository settings → Secrets and variables → Actions](https://github.com/delegram-pixel/sentinel/settings/secrets/actions).
You can also store the three deployment secrets in the GitHub `production` environment. Organization
secrets must grant this repository access. Setting a token only in Vercel's project environment does
not make it available to GitHub Actions.

The deploy job checks all three credentials before running its other steps. If `vercel pull` reports
that `--token` is missing a value, `VERCEL_TOKEN` was empty in the workflow. Add or correct the GitHub
secret, then rerun the failed deploy job.

Set `DATABASE_URL` and `DIRECT_URL` in Vercel's **Production** environment to the raw Neon connection
URLs. Each value must start with `postgresql://` or `postgres://`; do not paste the `psql` command,
literal surrounding quotes, or a variable such as `$DATABASE_URL`. Credentials containing special
characters must use URL percent encoding. `DIRECT_URL` must use the direct endpoint without
`-pooler.` in its hostname. The migration step validates both URLs and passes the pulled Vercel values
directly to Prisma, overriding any inherited database variables. A `P1013` error indicates an invalid
connection string; correct the named Vercel environment variable and rerun the deploy job.

### Web Analytics

[Vercel Web Analytics](https://vercel.com/docs/analytics) is mounted once in the root layout through
`@vercel/analytics/next`, so page views are reported automatically from production deployments.
Enable **Web Analytics** for the project in the Vercel dashboard; no additional environment variable
is required. Local development and tests do not send events.

### Operational notes

- Migrations always use `prisma migrate deploy`; never run `prisma migrate dev` against production.
- The durable research worker is not started by Vercel. Run `yarn worker` on a supervised host with
  the same database and storage configuration as the web deployment; see
  [`docs/v2/V2_OPERATIONS.md`](docs/v2/V2_OPERATIONS.md).
- Because migrations are applied before the new build is promoted, keep migrations additive and
  compatible with the previously deployed application version.

## Stack

- Next.js 16 (App Router, Cache Components)
- React 19
- TypeScript, strict mode
- Tailwind CSS v4 with shadcn/ui primitives
- Zod for runtime contracts
- PostgreSQL 17 with Prisma 7 and the `pg` driver adapter
- Vitest and Testing Library for unit tests
- Vitest with a real PostgreSQL database for integration tests
- Playwright for end-to-end tests

## Repository layout

```text
prisma/
  schema.prisma           Data model for ADR-001 to ADR-022
  migrations/             Ordered SQL migrations, including raw constraints
src/
  app/                    Routes, layouts, and global styles
    (dashboard)/          Authenticated application shell, Dashboard, and Settings
  components/
    layout/               Sidebar, header, breadcrumbs, app shell
    dashboard/            Workspace overview and real counts
    settings/             Identity and workspace details
    shared/               Reusable empty states and placeholders
    ui/                   shadcn/ui primitives
  config/                 Environment schemas and server/client entry points
  generated/prisma/       Generated Prisma client (never edited or committed)
  lib/                    Shared utilities and the Prisma singleton
  modules/                Domain modules, grouped by capability
    ai/                   AI task status and event contracts
    audit/                Workspace-scoped audit history and event contracts
    auth/                 Clerk profile synchronization and workspace provisioning
    findings/             Finding status and transition guard
    hypotheses/           Hypothesis status and transition guard
    security/             Capability registry and enforcement
    research/             Project, target, and scope services and persistence
    shared/               Shared result types
    verification/         AI and human verification conclusions
    workspaces/           Workspace ownership, access guards, and overview aggregates
tests/
  unit/                   Domain and component tests
  integration/            PostgreSQL schema and migration tests
  e2e/                    Playwright authentication, dashboard, and navigation tests
docs/                     Product, architecture, and decision records
```

Modules follow a `domain → application → infrastructure → presentation` dependency direction. The
domain layer must not import React, Next.js, Prisma, or provider SDKs.

## What is deliberately absent

- AI provider calls, prompts, and streaming
- Evidence storage and upload endpoints
- Any capability that reaches a network target

These are gated by decisions recorded in [`docs/DECISIONS.md`](docs/DECISIONS.md). Do not add them
ahead of their phase.

## Documentation

| Document                                                                       | Contents                               |
| ------------------------------------------------------------------------------ | -------------------------------------- |
| [`docs/PRD.md`](docs/PRD.md)                                                   | Product requirements                   |
| [`docs/TECHNICAL-REQUIREMENTS.md`](docs/TECHNICAL-REQUIREMENTS.md)             | Functional and technical requirements  |
| [`docs/TECHNICAL-ARCHITECTURE.md`](docs/TECHNICAL-ARCHITECTURE.md)             | Architecture and module boundaries     |
| [`docs/DATABASE-SCHEMA.md`](docs/DATABASE-SCHEMA.md)                           | Data model                             |
| [`docs/AI-ARCHITECTURE.md`](docs/AI-ARCHITECTURE.md)                           | AI orchestration and safety model      |
| [`docs/APP-FLOW.md`](docs/APP-FLOW.md)                                         | User flows                             |
| [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md)                   | Phased delivery plan                   |
| [`docs/DESIGN-BRIEF.md`](docs/DESIGN-BRIEF.md)                                 | Visual and interaction direction       |
| [`docs/DEVELOPMENT-READINESS-REPORT.md`](docs/DEVELOPMENT-READINESS-REPORT.md) | Conflicts and missing decisions        |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)                                       | Accepted architecture decisions (ADRs) |
| [`docs/ENGINEERING.md`](docs/ENGINEERING.md)                                   | Engineering conventions and guardrails |
| [`docs/PROJECT-STATUS.md`](docs/PROJECT-STATUS.md)                             | Current checkpoint and remaining work  |
| [`CLAUDE.md`](CLAUDE.md)                                                       | Guidance for AI coding agents          |

## Core invariants

1. `Workspace` is the sole tenancy root. Client-supplied IDs never establish access.
2. The active `ScopeVersion` is the sole authorization authority.
3. Evidence is investigation-owned, immutable, and linked through `EvidenceLink`.
4. Only a human reviewer can confirm a finding or mark it reportable.
5. AI tasks declare capabilities; unknown or disabled capabilities are denied.
6. UI mutations go through Server Actions; Route Handlers are reserved for asynchronous and
   external boundaries.
7. Audit records are append-only and never contain secrets or raw evidence.

# sentinel

# sentinel

# sentinel

# sentinel

# sentinel
