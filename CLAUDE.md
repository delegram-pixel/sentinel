# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this repository is

Sentinel Research is a security research workspace. It is currently in the **Phase 2 data layer**:
an application shell, design tokens, environment contract, executable domain contracts, the Prisma
schema, the initial migration, and a PostgreSQL integration harness. There is no authentication, AI
integration, evidence storage, or network capability.

Do not describe the product as operational or production-ready. Do not invent features, metrics, or
sample findings.

## Read before changing behaviour

1. `docs/DECISIONS.md` — accepted ADRs. These override older prose in every other document.
2. `docs/PRD.md` — product intent.
3. `docs/ENGINEERING.md` — conventions and guardrails.
4. `docs/DEVELOPMENT-READINESS-REPORT.md` — known conflicts and open decisions.

If code and a source document disagree, do not silently "fix" the document. Record a new ADR in
`docs/DECISIONS.md` and list the required amendments.

## Commands

```bash
yarn install
yarn dev
yarn lint
yarn typecheck
yarn test
yarn test:integration
yarn test:e2e
yarn format
yarn build
yarn db:validate
yarn db:migrate
```

A change is complete only when `yarn format:check && yarn lint && yarn typecheck && yarn test && yarn build`
passes. Run `yarn test:e2e` for routing or shell changes.

## Current scope

Allowed:

- Shell, layout, responsive navigation, and accessibility fixes
- Design tokens and shadcn/ui primitives
- Pure domain contracts and their unit tests
- Environment schema hardening
- Prisma schema and migrations that implement accepted ADRs
- Workspace-scoped repositories and integration tests against PostgreSQL
- Documentation that records decisions

Not allowed without an explicit new decision:

- Clerk integration, sessions, or workspace provisioning
- Anthropic calls, prompts, streaming, or usage budgets
- Evidence upload, object storage, or signed URLs
- Any capability that performs network requests against a target
- Adding routes that imply working features

## Non-negotiable invariants

1. `Workspace` is the sole tenancy root. Never trust a client-supplied workspace ID.
2. The active `ScopeVersion` is the sole authorization authority. Target status is derived.
3. Evidence is investigation-owned, immutable, and linked through `EvidenceLink`.
4. Only a human reviewer can set `CONFIRMED` or `REPORTABLE`.
5. AI tasks declare capabilities. Unknown, disabled, or prohibited capabilities are denied.
6. Server Actions are canonical for UI mutations. Route Handlers are limited to async/external
   boundaries. Never implement both for one operation.
7. Audit records are append-only and contain no secrets or raw evidence.
8. AI never modifies scope, approvals, or verification conclusions reserved for humans.

## Code rules

- Domain code in `src/modules/*/domain/` is pure: no React, Next.js, Prisma, or provider SDKs.
- Status transitions are enforced by the guards in:
  - `src/modules/findings/domain/finding-status.ts`
  - `src/modules/hypotheses/domain/hypothesis-status.ts`
  - `src/modules/ai/domain/ai-task-status.ts`
  - `src/modules/verification/domain/verification-conclusion.ts`
  - `src/modules/security/domain/capability.ts`
- Do not duplicate a status list or transition rule in a component, a database enum comment, or a
  Server Action.
- Add new environment variables to `src/config/env.schema.ts` and `.env.example`. Never read
  `process.env` elsewhere, and never import `env.server.ts` into client code.
- New code imports `cn` from `@/lib/utils`. All UI primitives use this helper, so class merging stays
  consistent across app and generated components. Radix primitives are imported from `radix-ui`.
- Use design tokens from `src/app/globals.css`. No hard-coded hex colours in components.
- Empty states must be honest. Say what is missing and what will populate it.

## Testing expectations

- Every domain rule has unit tests, including denial paths.
- Every new capability needs a test proving it is refused before it is implemented.
- Tests must not require production secrets, real AI calls, or live targets.
- Prefer pure functions and dependency injection over mocking internals.

## Style

- TypeScript strict mode, no `any` unless isolated at a provider boundary with a comment.
- Prefer named exports for functions and types; default exports are for Next.js route files and
  layouts.
- Keep files focused. Extract when a file mixes domain rules with presentation.
- Write user-facing copy that states uncertainty accurately. "Self-attested" is not "verified".
- Avoid decorative security clichés, neon effects, and dashboard theatre.

## When you are unsure

Stop and ask, or record the ambiguity in `docs/DECISIONS.md` as a proposed ADR. Do not guess at
security behaviour, tenancy, authorization, evidence handling, or AI permissions.
