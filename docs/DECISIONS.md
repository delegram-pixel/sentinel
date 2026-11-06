# SENTINEL RESEARCH
# Decision Register

**Purpose:** Records product and architecture decisions that the source documents leave open or contradict. Source documents are not edited silently; each ADR lists the amendments required once the decision is ratified.

**Status:** Ten blocking decisions, the seven schema-pack decisions, and the five platform decisions accepted on 3 November 2026. The AI execution pack was accepted on 6 November 2026 as ADR-025, and report PDF export and template management as ADR-027. Source-document amendments remain outstanding for most ADRs; the ADR-004, ADR-008, ADR-013, and ADR-019 amendments were applied on 6 November 2026.

**Date opened:** 3 November 2026

---

## Register

| ID | Decision | Status | Date |
|---|---|---|---|
| ADR-001 | Workspace is the sole tenancy root | Accepted | 2026-11-03 |
| ADR-002 | Authentication provider: Clerk | Accepted | 2026-11-03 |
| ADR-003 | Authorization authority and attestation model | Accepted | 2026-11-03 |
| ADR-004 | Evidence ownership, linking, upload, and immutability | Accepted | 2026-11-03 |
| ADR-005 | Canonical status enums and transitions | Accepted | 2026-11-03 |
| ADR-006 | AI credential and cost model | Accepted | 2026-11-03 |
| ADR-007 | Scope-gated capability model / delegated mode | Accepted | 2026-11-03 |
| ADR-008 | Report ownership, templates, and revision snapshots | Accepted | 2026-11-03 |
| ADR-009 | API and mutation strategy | Accepted | 2026-11-03 |
| ADR-010 | Audit and membership phase order | Accepted | 2026-11-03 |
| ADR-011 | Relational join models for hypotheses, observations, and scope rules | Accepted | 2026-11-03 |
| ADR-012 | AI task traceability and workspace isolation | Accepted | 2026-11-03 |
| ADR-013 | Redaction before evidence activation; quarantine and AI-safe gate | Accepted | 2026-11-03 |
| ADR-014 | Onboarding and personal-workspace provisioning | Accepted | 2026-11-03 |
| ADR-015 | Duplicate detection and resolution | Accepted | 2026-11-03 |
| ADR-016 | Severity assessment and affected asset capture | Accepted | 2026-11-03 |
| ADR-017 | Target and scope field completion; derived authorization | Accepted | 2026-11-03 |
| ADR-018 | Vercel, Neon, and pooled Prisma connections | Accepted | 2026-11-03 |
| ADR-019 | Cloudflare R2 private object storage and upload constraints | Accepted | 2026-11-03 |
| ADR-020 | Upstash Redis for rate limiting | Accepted | 2026-11-03 |
| ADR-021 | CI, test database, and deterministic AI mock | Accepted | 2026-11-03 |
| ADR-022 | Secrets management and deferred BYOK encryption | Accepted | 2026-11-03 |
| ADR-023 | Onboarding deferred; first authenticated access provisions the workspace | Accepted | 2026-11-04 |
| ADR-024 | Investigation creation authorization, lifecycle, and manual summaries | Accepted | 2026-11-06 |
| ADR-025 | AI execution pack: structured output, budgets, prompts, injection defence, and provider surface | Accepted | 2026-11-06 |
| ADR-026 | Editorial Research Console visual system and interface redesign | Accepted | 2026-11-06 |
| ADR-027 | Report PDF export and template management | Accepted | 2026-11-06 |

---

## ADR-001 — Workspace is the sole tenancy root

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-01, M-18 (partially); M-40 is completed by ADR-014

### Context

The database ERD models `User → Project`, while `Project` carries a required `workspaceId`, DB §7.1 states every project must belong to a workspace, and TA §5.3 requires every query to enforce workspace ownership. The PRD requires an architecture that supports teams later without making team features part of the MVP.

### Decision

1. `Workspace` is the sole tenancy and ownership root.
2. Every `Project` belongs to exactly one `Workspace`.
3. Each user receives one personal workspace, auto-provisioned on first authenticated access.
4. `ownerId` on projects and workspaces records the creating user; it is not the access boundary.
5. All repository and service queries resolve the workspace server-side. A client-supplied workspace ID is never trusted without a membership check.
6. MVP routes remain flat (`/dashboard/projects/...`). Workspace-scoped URLs (`/w/[workspaceSlug]`) are deferred until team features ship.
7. `WorkspaceMember` exists from the first schema, but MVP enforcement treats the single personal workspace owner as `OWNER`.

### Consequences

- The ERD must be corrected to show `USER ||--o{ WORKSPACE` and `WORKSPACE ||--o{ PROJECT`.
- User provisioning must create a workspace atomically with the user profile.
- Every module needs a shared "resolve workspace access" guard; this becomes a cross-cutting requirement.
- Future team support does not require a schema migration of ownership.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §2 ERD: replace `USER ||--o{ PROJECT : owns` with the workspace path.
- `APP-FLOW.md` §2–3: document workspace auto-provisioning and its relationship to onboarding.
- `TECHNICAL-ARCHITECTURE.md` §5.3: confirm flat MVP routes and deferred workspace URLs.

### Follow-ups

- ADR-002 (auth provider) determines how user identity is synchronized before provisioning.
- ADR-014 resolves M-40 (onboarding route, completion flag, provisioning trigger).

---

## ADR-002 — Clerk is the authentication provider

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-08

### Context

TRD recommends Clerk. TA permits Auth.js or Clerk but requires choosing one. The environment example is Auth.js-shaped, creating an implicit and contradictory default. Authentication is the first external dependency of Phase 2.

### Decision

1. Clerk is the sole authentication provider for the MVP. Auth.js is not implemented.
2. Clerk middleware and server helpers enforce protected routes; application-level authorization remains a separate layer.
3. Users are synchronized through a signed Clerk webhook (`user.created`, `user.updated`, `user.deleted`) into `User`. The webhook handler is idempotent and keyed by Clerk user ID.
4. `User.authProviderId` stores the Clerk user identifier. No passwords or credentials are stored in the application database.
5. User creation and personal-workspace provisioning (ADR-001) happen in one transaction.
6. Environment variables are Clerk-specific: publishable key, secret key, and webhook signing secret. The Auth.js variables in TA §15 are removed.
7. Authorization checks remain server-side and are never inferred from the presence of a Clerk session alone.

### Consequences

- Local development requires a Clerk development instance; tests need an auth bypass or mocked session.
- The webhook endpoint must be added to the public API surface and must verify signatures.
- Account deletion must propagate from Clerk to the application and storage lifecycle.
- Vendor lock-in is contained to `authProviderId` and the sync adapter.

### Required document amendments (not yet applied)

- `TECHNICAL-REQUIREMENTS.md` §2: change "Initial recommendation: Clerk" to a decision.
- `TECHNICAL-ARCHITECTURE.md` §5.1: remove "Auth.js or Clerk".
- `TECHNICAL-ARCHITECTURE.md` §15: replace Auth.js environment variables with Clerk variables.
- `TECHNICAL-ARCHITECTURE.md` §23: replace "Clerk or Auth.js" with Clerk.

### Follow-ups

- Define webhook idempotency storage (event ID table or unique constraint).
- Define account-deletion and data-retention behaviour (M-05).
- Define onboarding completion and workspace provisioning trigger (M-40).

---

## ADR-003 — Active ScopeVersion is the sole authorization authority; MVP authorization is self-attested

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-06, C-10, M-01

### Context

`Target.authorizationStatus` and `authorizationExpiresAt` duplicate `ScopeVersion.status` and `effectiveUntil`. No document defines which wins, how a target becomes `AUTHORIZED`, or how a scope's authorization evidence is stored when evidence requires an investigation.

### Decision

1. The active `ScopeVersion` is the sole authority for permitted activity.
2. `Target.authorizationStatus` is a derived summary, recomputed as the most restrictive state:
   - no scope or no attestation → `PENDING` / `UNVERIFIED`
   - active scope within its effective window → `AUTHORIZED`
   - window passed → `EXPIRED`
   - explicit revocation → `REVOKED`
3. `Target.authorizationExpiresAt` is derived from the active scope. It is not independently editable.
4. MVP authorization is **self-attestation**. A scope cannot become `ACTIVE` without:
   - an authorization source,
   - an authorization date,
   - an effective-until date,
   - the attesting user,
   - and an audit record.
5. The UI and reports label this as **"self-attested"**. The product does not claim external verification in the MVP.
6. Authorization evidence is stored in a dedicated `AuthorizationArtifact` model owned by the target/workspace, not in `Evidence`. This resolves the circular dependency in C-10.
7. Scope statuses become `DRAFT`, `ACTIVE`, `SUPERSEDED`, `EXPIRED`, `REVOKED`. At most one scope version may be `ACTIVE` per target, enforced by a partial unique index.
8. The scope validator runs server-side at action time. It does not trust cached target status or client state.
9. External verification (program API integration, manual reviewer approval) is deferred.

### Consequences

- The scope validator becomes a central, cross-cutting service; all target-touching capabilities must call it.
- Target status reads may require recomputation; the implementation must define whether this is computed on read or updated by a scheduled/event-driven job.
- The PRD's "authorization evidence" requirement is satisfied by `AuthorizationArtifact`, not by the evidence library.
- The product must be honest in UI copy: self-attested is not verified.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.5–3.6: derive target status, add `SUPERSEDED`, add `AuthorizationArtifact`, remove duplicate expiry semantics.
- `TECHNICAL-ARCHITECTURE.md` §9: name the active scope as sole authority and define attestation.
- `APP-FLOW.md` §6–7: add the self-attestation fields and disclosure.
- `PRD.md` §4.3: clarify that MVP authorization is user-attested.

### Follow-ups

- Define the capability model that consumes this validator (ADR-007 / M-02).
- Target authorization is materialised and recomputed at action time (ADR-017).
- Define expiry notifications and re-attestation flow.

---

## ADR-004 — Evidence is investigation-owned, linked to findings, presigned, and immutable

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-05, C-15, M-11

### Context

DB models evidence as investigation-owned with `EvidenceLink`; TA adds `workspaceId`, `projectId`, and direct `findingId`; TRD uploads directly while TA uses a presigned URL; FLOW requires immutable evidence with versioned corrections, but the schema and API allow hard delete.

### Decision

1. `Evidence` belongs to exactly one investigation. `investigationId` is required.
2. `workspaceId` is denormalized onto the evidence record for query isolation and is maintained by the service layer. `projectId` is derived through the investigation.
3. Findings are linked only through `EvidenceLink` with relationship types `SUPPORTS`, `CONTRADICTS`, `CONTEXT`, and `REPRODUCTION`. There is no direct `findingId` on evidence.
4. Evidence types are: `SCREENSHOT`, `HTTP_REQUEST`, `HTTP_RESPONSE`, `TEXT_OBSERVATION`, `DOCUMENT`, `LOG`, `EXTERNAL_REFERENCE`, `REPRODUCTION_NOTE`, `OTHER`.
5. Upload uses a two-step presigned flow:
   - the client requests an upload intent;
   - the server validates authentication, workspace access, scope, MIME type, and size;
   - the server returns a short-lived presigned PUT URL and an evidence ID;
   - the client uploads directly to private storage;
   - the client calls finalize; the server verifies object metadata and checksum before marking the evidence active.
6. Evidence content is immutable after finalization. Corrections create a new record with `version` and `supersedesId`.
7. Deletion is soft (`deletedAt`) and subject to the retention policy. Hard delete is an administrative retention job, not an API action.
8. Downloads use short-lived signed URLs after a server-side ownership check.
9. Redaction status is stored (`NOT_REVIEWED`, `REDACTED`, `VERIFIED_SAFE`), but the redaction pipeline is decided separately (M-04).
10. Authorization artifacts are not evidence (ADR-003). Report exports are generated artifacts, not evidence.

### Consequences

- Storage requires an S3-compatible private bucket and a presigned URL implementation.
- The upload intent and finalize endpoints are part of the API surface.
- Evidence queries can be workspace-scoped without joining every parent table.
- Immutability means the editing UI must be "supersede", not "edit".
- The evidence library shows versions as a chain, not as independent files.

### Required document amendments (applied 2026-11-06)

- `DATABASE-SCHEMA.md` §3.11–3.12: add `workspaceId`, `version`, `supersedesId`, `deletedAt`, and the expanded type enum. **Applied.**
- `TECHNICAL-ARCHITECTURE.md` §10.3: remove `findingId`, align field names. **Applied.**
- `TECHNICAL-REQUIREMENTS.md` §7: replace direct evidence POST with intent + finalize endpoints. **Applied.**
- `APP-FLOW.md` §11: describe the two-step upload and version-on-correction behaviour. **Applied.**

### Follow-ups

- Redaction pipeline and AI gate resolved by ADR-013.
- Decide object storage provider, size limits, and malware scanning (M-29, M-30).
- Define retention and hard-delete job (M-05).

---

## ADR-005 — Canonical statuses and transitions

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-02, C-03, C-04, M-10

### Decision

#### Finding statuses

`DRAFT`, `NEEDS_VALIDATION`, `UNDER_REVIEW`, `CONFIRMED`, `FALSE_POSITIVE`, `REJECTED`, `REPORTABLE`, `CLOSED`.

Allowed transitions:

| From | To | Actor |
|---|---|---|
| `DRAFT` | `NEEDS_VALIDATION` | Researcher |
| `NEEDS_VALIDATION` | `UNDER_REVIEW` | Researcher |
| `UNDER_REVIEW` | `NEEDS_VALIDATION` | Researcher / Reviewer |
| `UNDER_REVIEW` | `CONFIRMED` | Human reviewer only |
| `UNDER_REVIEW` | `REJECTED` | Human reviewer only |
| `UNDER_REVIEW` | `FALSE_POSITIVE` | Human reviewer only |
| `CONFIRMED` | `REPORTABLE` | Human reviewer only |
| `CONFIRMED` | `CLOSED` | Researcher / Reviewer |
| `REPORTABLE` | `CLOSED` | Researcher / Reviewer |
| `REJECTED` | `CLOSED` | Researcher / Reviewer |
| `FALSE_POSITIVE` | `CLOSED` | Researcher / Reviewer |

`IDEA` and `OBSERVED` are not finding statuses.

#### Hypothesis statuses

`IDEA`, `OBSERVED`, `NEEDS_VALIDATION`, `CONFIRMED`, `NOT_REPRODUCIBLE`, `REJECTED`.

Allowed transitions: `IDEA → OBSERVED → NEEDS_VALIDATION → {CONFIRMED | NOT_REPRODUCIBLE | REJECTED}`, with `NEEDS_VALIDATION → OBSERVED` allowed to record renewed observation.

#### AI task statuses

`PENDING`, `RUNNING`, `AWAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`.

Lifecycle stages (`PERMISSION_CHECK`, `CONTEXT_ASSEMBLY`, `TASK_ASSIGNMENT`, `OUTPUT_VALIDATION`, `RESULT_STORAGE`, `HUMAN_REVIEW`) are recorded as `AITaskEvent` rows, not statuses.

#### Verification conclusions

Split by reviewer type:

- `AI`: `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, `REVIEW_SUPPORTS_CONFIRMATION`
- `HUMAN`: `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, `CONFIRMED`, `REJECTED`

An AI-authored review may never carry `CONFIRMED`. Any transition to `CONFIRMED` or `REPORTABLE` requires a human review record and is audit-logged with the approving user.

### Consequences

- Status guards are shared domain code, not UI conditionals.
- The UI derives labels from the canonical enums and never invents synonyms.
- Tests must cover every allowed transition and reject every disallowed one.
- `Finding.approvedBy` is a denormalized pointer to the human approval; the authoritative record is the human `VerificationReview`.

### Required document amendments (not yet applied)

- `PRD.md` §4.6: replace the finding status list.
- `DATABASE-SCHEMA.md` §3.10, §4.4, §4.6: align enums and add `SUPERSEDED`/`TIMED_OUT` where decided.
- `TECHNICAL-REQUIREMENTS.md` §6 and §10: align the example conclusion and task statuses.
- `TECHNICAL-ARCHITECTURE.md` §8.4 and §11.1: align lifecycle and finding diagrams.
- `AI-ARCHITECTURE.md` §4.3 and §7: align conclusions and lifecycle.

### Follow-ups

- Encode the transition matrix as pure domain functions with unit tests in the foundation slice.
- Duplicate detection resolved by ADR-015. Reopening rules remain open.
- Define the reportability review checklist (PRD §4.8, FLOW §12).

---

## ADR-006 — Platform-owned AI key with enforced budgets

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-07, M-03

### Context

Onboarding asks users to configure Claude credentials, `AIProviderConfig` stores a per-user encrypted credential reference, and the environment contract defines a single server-side `ANTHROPIC_API_KEY`. The PRD mitigates cost risk through platform-controlled usage limits. These models are incompatible.

### Decision

1. The MVP uses one platform-owned Anthropic key, stored only in server-side environment secrets.
2. Users do not provide AI credentials during onboarding. The onboarding step explains AI usage, privacy, and limits instead.
3. `AIProviderConfig` remains for model preference and future BYOK, but `encryptedCredentialReference` is unused in the MVP. It must not be exposed through the API.
4. Every AI task records token usage, model, and provider. Every message records usage where available.
5. Per-task input/output budgets and a per-user daily token cap are enforced server-side. The cap applies before the provider call, not after.
6. When a budget is exhausted, the task fails with a stable `RATE_LIMIT_ERROR`/`AI_BUDGET_EXCEEDED` code. The system does not silently switch to a cheaper model or silently truncate evidence.
7. Provider credentials never reach the browser, logs, AI prompts, or error messages.
8. BYOK is deferred until billing, tenant isolation, and secret-management design exist.

### Consequences

- The onboarding flow, `AIProviderConfig` UI, and env contract must be updated together.
- Usage tracking becomes a billing-adjacent concern even before billing exists.
- The platform bears AI cost; abuse controls and rate limiting are mandatory.
- A future BYOK migration needs an encryption/key-management design (M-35).

### Required document amendments (not yet applied)

- `APP-FLOW.md` §3 Step 5: replace credential entry with usage/privacy disclosure.
- `DATABASE-SCHEMA.md` §4.1: mark the credential field as reserved and unused in MVP.
- `TECHNICAL-ARCHITECTURE.md` §15: confirm the platform key and budget variables.
- `PRD.md` §10: reference the concrete budget enforcement.

### Follow-ups

- Set numeric per-task and per-user budgets (M-20).
- Define usage-monitoring and alert thresholds.
- Define the future BYOK encryption design (M-35).

---

## ADR-007 — Scope-gated capability registry; MVP is analysis-only

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-09, M-02, M-22

### Context

The MVP has no scanning, exploitation, browser, or shell capability, yet several documents require scope enforcement for delegated testing and PRD acceptance criterion 13 requires unauthorized actions to be blocked. Without named capabilities, there is nothing to enforce or test, and "Delegated Mode" remains ambiguous.

### Decision

1. Define a versioned capability registry. Every AI task declares the capabilities it requires.
2. The orchestrator checks, in order: authentication, workspace access, investigation access, target scope, mode, capability enablement, and approval requirement. A missing or unknown capability denies the task.
3. MVP capability status:

| Capability | Status | Requirement |
|---|---|---|
| `READ_PROJECT_CONTEXT` | Enabled | Workspace membership |
| `READ_INVESTIGATION_CONTEXT` | Enabled | Workspace membership |
| `AI_ANALYZE_SUPPLIED_CONTENT` | Enabled | Workspace membership |
| `AI_ANALYZE_TARGET_CONTEXT` | Enabled | Target documented; supplied metadata only; no network |
| `EXPORT_REPORT` | Enabled | Human-approved `REPORTABLE` finding |
| `MODIFY_SCOPE` | Human-only | Explicit human action; AI never |
| `PASSIVE_FETCH` | Not implemented | Would require active scope and SSRF controls |
| `ACTIVE_TEST` | Not implemented | Would require active scope and separate approval |
| `BROWSE_WEB` | Not implemented | Not permitted |
| `EXECUTE_COMMAND` | Prohibited | Never |
| `SUBMIT_EXTERNAL_REPORT` | Prohibited | Never |

4. Delegated Mode is a structured analysis task with a declared capability set. It produces proposed observations or hypotheses. A human accepts, edits, or rejects the result. It is not autonomous testing.
5. `RECON_ANALYSIS` and `ATTACK_SURFACE_ANALYSIS` operate only on supplied content and documented metadata in the MVP. They perform no external retrieval.
6. Every capability denial is audit-logged with the required capability, task, target, and reason.
7. Adding a capability requires a new ADR, a scope rule, a threat model update, and security tests.

### Consequences

- PRD acceptance criterion 13 becomes testable: each disabled or prohibited capability must be refused server-side.
- `AITask` must store the required capability set (or a task-type mapping must resolve it deterministically).
- The scope validator (ADR-003) is called by the orchestrator, not by the UI.
- The product must not advertise passive or active recon until those capabilities exist.

### Required document amendments (not yet applied)

- `PRD.md` §5: define delegated mode as structured analysis, not execution.
- `TECHNICAL-REQUIREMENTS.md` §5.7 and §6: add the capability check to the AI module and task types.
- `TECHNICAL-ARCHITECTURE.md` §8.7 and §9.3: reference the registry as the enforcement point.
- `AI-ARCHITECTURE.md` §11: replace the prose allow/approve/prohibit lists with the registry.
- `APP-FLOW.md` §9: describe the capability check and denial state.

### Follow-ups

- Map each AI task type to its required capabilities.
- Define the approval gate for `AWAITING_APPROVAL`.
- Threat-model `PASSIVE_FETCH` before it is ever implemented (SSRF, rate limits, scope).

---

## ADR-008 — Reports are investigation-owned, template-driven, and snapshot evidence per revision

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-11, M-15

### Context

The DB attaches reports to an investigation; the report flow begins with a confirmed finding; the TA relationship tree places reports under a project. No template model exists, and revisions do not preserve the evidence references used at generation time.

### Decision

1. A `Report` belongs to exactly one investigation.
2. A `ReportFinding` join table lists included findings with an order. This supports single-finding and multi-finding reports.
3. A `ReportTemplate` model stores workspace-owned or system templates. Templates are versioned and define a section schema.
4. `ReportRevision` stores:
   - the rendered content,
   - an evidence snapshot (evidence ID, version, checksum, title at generation time),
   - the included finding IDs and their statuses at generation time,
   - generating actor, model, and prompt version where AI-assisted.
5. Report statuses: `DRAFT`, `UNDER_REVIEW`, `APPROVED`, `EXPORTED`, `ARCHIVED`. A human must approve before export.
6. Markdown is the canonical content format. PDF is a derived export. The PDF implementation is decided separately (M-37).
7. Reports must label verified observations, assumptions, and missing information separately.
8. A report cannot include a finding that is not `CONFIRMED` or `REPORTABLE`.

### Consequences

- The report model is no longer a single flat content field; revisions carry structured snapshots.
- Export is a rendering concern and must not mutate the underlying finding or evidence.
- Template changes do not rewrite historical revisions.
- The UI must support selecting one or more findings from the investigation.

### Required document amendments (applied 6 November 2026)

- `DATABASE-SCHEMA.md` §5: add `ReportFinding` and `ReportTemplate`, add snapshot fields to `ReportRevision`.
- `TECHNICAL-ARCHITECTURE.md` §6.4: move `Report` under the investigation, not the project.
- `APP-FLOW.md` §13: describe finding selection and revision snapshots.
- `TECHNICAL-REQUIREMENTS.md` §5.8: add template management.
- `PRD.md` §4.9: clarify that reports are investigation-scoped.

### Follow-ups

- ~~The reports v1 implementation uses a built-in Markdown section schema. Template selection and
  workspace/system template management are not exposed in the UI yet.~~ Resolved by ADR-027.
- ~~Decide PDF generation and template rendering (M-37).~~ Resolved by ADR-027.
- Define the report completeness checklist; v1 validates finding readiness and required evidence
  before submission and approval.
- ~~Seed system templates for common report types.~~ Seeded by migration in ADR-027.

---

## ADR-009 — Server Actions for UI mutations; Route Handlers for async and external boundaries

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-14

### Context

TRD defines a broad REST surface for nearly every operation. TA prefers Server Actions for UI mutations and Route Handlers for asynchronous or external operations. Neither declares a canonical path, creating a risk of duplicate mutation endpoints with divergent authorization.

### Decision

1. Server Actions are canonical for first-party UI mutations:
   - projects, targets, scope, investigations, observations, hypotheses;
   - findings and finding transitions;
   - evidence metadata, linking, and soft deletion;
   - report editing and approval.
2. Route Handlers are limited to boundaries that require HTTP:
   - Clerk webhooks;
   - AI streaming responses;
   - AI task polling/status;
   - evidence presigned upload intent and finalize;
   - report export downloads;
   - a future public API.
3. One canonical path per operation. An internal contract table records the path; the same operation is never exposed through both a Server Action and a Route Handler.
4. Server Actions and Route Handlers call the same service layer, Zod schemas, authorization guard, and audit function.
5. Server Actions return typed results (success/error union). Route Handlers use the response envelope in TA §7.3.
6. The TRD REST list is treated as a future public API, not as the MVP internal API.
7. Authorization and validation are never implemented in the route/action wrapper; wrappers only parse, authenticate, delegate, and map errors.

### Consequences

- The API surface is smaller and easier to audit.
- Client components must use actions or fetch only the documented routes.
- Route Handlers need explicit CSRF/signature handling for webhooks and upload intents.
- A future public API will require a versioned contract layer, not a duplication of current actions.

### Required document amendments (not yet applied)

- `TECHNICAL-REQUIREMENTS.md` §7: mark the REST list as a future public API and align evidence endpoints.
- `TECHNICAL-ARCHITECTURE.md` §7.1–7.2: add the canonical path rule and the contract table reference.
- `TECHNICAL-ARCHITECTURE.md` §19.3: add "one mutation path per operation".

### Follow-ups

- Publish the internal contract table during the foundation slice.
- Define the shared error mapping for actions and routes.
- Define rate limiting per action/route.

---

## ADR-010 — Workspace membership and audit logging move to Phase 2

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** C-16

### Context

DB §10 schedules `AuditLog` and `WorkspaceMember` for Phase 4. TA Phase 2 implements `WorkspaceMember`, and the security requirements demand audit logging from the beginning. ADR-001 requires membership from the first schema. Deferring audit means early auth, scope, and finding actions are unlogged.

### Decision

1. `WorkspaceMember` and `AuditLog` are implemented in Phase 2.
2. The personal workspace owner is seeded as `OWNER`. Role-management UI and multi-member flows are deferred.
3. Audit events are added as each module is built:
   - Phase 2: authentication failures, permission denials, workspace provisioning, membership changes;
   - Phase 3: project, target, scope, and authorization changes;
   - Phase 5: finding transitions, evidence changes, human approvals;
   - Phase 6: report approval and export;
   - Phase 4: AI task creation, denial, failure, and completion.
4. Audit rows are append-only. Application code cannot update or delete them. Retention is handled by a privileged job under the retention policy.
5. Audit fields: actor, workspace, action, entity type/ID, redacted previous/new values, metadata, timestamp. Secrets, tokens, raw evidence, and sensitive personal data are never stored.
6. Audit is written through a shared service, not ad hoc in route handlers or Server Actions.
7. A denial is audited even when the operation is rejected before any state change.

### Consequences

- Phase 2 grows slightly but avoids a cross-cutting retrofit.
- The audit service becomes a dependency of nearly every module; it must fail safely and must not leak data.
- The database needs an append-only policy or restricted application role for audit writes.
- Role enforcement remains simple: one owner per personal workspace in the MVP.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §10: move `AuditLog` and `WorkspaceMember` to Phase 2.
- `TECHNICAL-ARCHITECTURE.md` §20 Phase 2: add audit logging to the deliverable.
- `IMPLEMENTATION-PLAN.md` §4: add audit and membership to Phase 1/2 tasks.
- `TECHNICAL-REQUIREMENTS.md` §7: clarify that audit applies to sensitive state changes, not literally every request.

### Follow-ups

- Define the concrete audit event catalog and retention period (M-05).
- Decide whether audit immutability is enforced by database permissions, triggers, or both.
- Define role enforcement when teams ship.

---

## ADR-011 — Relational join models for hypotheses, observations, and scope rules

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-09

### Context

The database lists `Hypothesis.supportingObservations`, `Hypothesis.contradictingObservations`, `ScopeVersion.allowedAssets`, `excludedAssets`, `permittedActivities`, and `prohibitedActivities` without specifying storage. JSON arrays cannot enforce referential integrity, support reverse queries, or give the scope validator a reliable rule set.

### Decision

1. Hypothesis-to-observation links become `HypothesisObservation`:
   - `id`
   - `hypothesisId` (required, cascade on hypothesis delete)
   - `observationId` (required, restrict on observation delete)
   - `relationshipType`: `SUPPORTS`, `CONTRADICTS`, `CONTEXT`
   - `createdBy`
   - `createdAt`
   - Unique `(hypothesisId, observationId)`.
2. Scope assets become `ScopeAsset`:
   - `id`
   - `scopeVersionId` (required, cascade on scope delete)
   - `assetIdentifier`
   - `assetType` (`DOMAIN`, `APPLICATION`, `API`, `IP_ASSET`, `LOCAL_LAB`, `OTHER`)
   - `matchType`: `EXACT`, `DOMAIN`, `SUBDOMAIN`, `CIDR`, `URL_PREFIX`
   - `effect`: `ALLOWED`, `EXCLUDED`
   - `notes`
   - `createdAt`
   - Unique `(scopeVersionId, assetIdentifier, matchType)`.
3. Scope activities become `ScopeActivityRule`:
   - `id`
   - `scopeVersionId` (required, cascade on scope delete)
   - `activity` (the `Capability` vocabulary from ADR-007)
   - `effect`: `PERMITTED`, `PROHIBITED`
   - `createdAt`
   - Unique `(scopeVersionId, activity)`.
4. `Hypothesis.missingInformation` remains free text. It is narrative, not a relation.
5. The array fields named above are removed. There is no JSON fallback.
6. Scope matching is deny-by-default:
   - any matching `EXCLUDED` asset denies, regardless of an overlapping `ALLOWED` asset;
   - a scope-requiring capability must have an explicit `PERMITTED` activity rule;
   - the absence of a rule denies.
7. Asset identifiers are normalized by the service layer (trim, lowercase host, remove default ports and trailing slashes) before persistence and comparison. A CIDR or URL prefix is validated against its `matchType`.
8. Deleting a scope version is not permitted; scope versions are status-managed. Join rows cascade only if a version is removed by an administrative retention job.

### Consequences

- Scope evaluation becomes a real query over explicit rules rather than parsing JSON.
- The scope validator can explain a denial by naming the matched exclusion or missing permission.
- The UI must support structured asset and activity editors, not comma-separated text fields.
- More tables and joins; migrations are straightforward and there is no legacy data to backfill.
- Overlapping allow/exclude rules are resolved by the documented precedence rather than by ordering.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.6: replace the four scope arrays with `ScopeAsset` and `ScopeActivityRule`.
- `DATABASE-SCHEMA.md` §3.9: replace the two observation arrays with `HypothesisObservation`.
- `DATABASE-SCHEMA.md` §8: add indexes on `scopeVersionId`, `hypothesisId`, and `observationId`.
- `TECHNICAL-ARCHITECTURE.md` §9: document deny-by-default and exclusion precedence.
- `APP-FLOW.md` §6–7: describe the structured scope editor.

### Follow-ups

- Define supported wildcard and CIDR semantics in the scope validator tests.
- Decide whether `ScopeAsset` needs a human-readable label separate from the identifier.

---

## ADR-012 — AI task traceability and workspace isolation

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-12

### Context

The AI success criteria require prompt, model, and context traceability, while `AITask` stores only operational fields. `AITask` also has no direct workspace reference, which weakens query isolation and makes idempotency scoping ambiguous.

### Decision

`AITask` gains the following required or nullable fields:

| Field | Type | Rule |
|---|---|---|
| `workspaceId` | string | Required, denormalized from the investigation, indexed |
| `requestedBy` | string | Required user ID |
| `provider` | enum | `ANTHROPIC` in the MVP; extensible by ADR |
| `model` | string | Exact model identifier used for the call |
| `promptTemplateId` | string | Server-side template identifier |
| `promptVersion` | string | Version of the template used |
| `contextVersion` | string | SHA-256 of the canonical assembled context |
| `idempotencyKey` | string | Required; unique per workspace |
| `requiredCapabilities` | `Capability[]` | Required; non-empty for analysis tasks |
| `inputTokenBudget` | integer | Applied per-task limit |
| `outputTokenBudget` | integer | Applied per-task limit |
| `inputTokens` | integer | Actual usage, default 0 |
| `outputTokens` | integer | Actual usage, default 0 |
| `estimatedCostUsd` | decimal(12,6) | Estimated at call time from a versioned price table |
| `parentTaskId` | string? | Retry lineage; never revives the parent |
| `failureCode` | string? | Stable application code, not a provider message |
| `correlationId` | string? | Log correlation, indexed |

1. `idempotencyKey` is unique per `(workspaceId, idempotencyKey)`. Re-submitting the same key returns the existing task.
2. A retry creates a new task with `parentTaskId`; terminal tasks are never revived.
3. Traceability fields are immutable after the task reaches a terminal state. Only status, usage, cost, and failure code are written during execution.
4. Prompt text is not stored on the task. The prompt registry retains versioned templates, and the task references the exact version.
5. `inputContext` and `output` are structured JSON. They are redacted before persistence and never contain secrets, tokens, or provider credentials.
6. Every state change writes an `AITaskEvent` using the event vocabulary in ADR-005.
7. Historical tasks keep their recorded provider, model, and prompt version even if configuration or defaults change later.

### Consequences

- Every AI task is reproducible enough for audit and evaluation without storing the full prompt body in the row.
- Cost reporting is possible before billing exists.
- The orchestrator must generate and persist idempotency keys before calling the provider.
- The prompt registry and price table become versioned platform assets.
- `AITask` queries must include `workspaceId` as well as `investigationId`.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §4.4: add the traceability, budget, usage, and lineage fields.
- `DATABASE-SCHEMA.md` §8: add the workspace/idempotency and correlation indexes.
- `AI-ARCHITECTURE.md` §4–6: reference the task traceability contract.
- `TECHNICAL-REQUIREMENTS.md` §6: add traceability acceptance criteria.

### Follow-ups

- Define the versioned model price table and its update procedure.
- Decide trace retention separately from conversation retention (M-05).
- Define stable `failureCode` values and their user-facing messages.

---

## ADR-013 — Redaction before evidence activation; quarantine and AI-safe gate

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-04

### Context

The PRD requires sensitive information to be redacted before storage or AI processing, while the schema models redaction as a post-upload status. Storing an unreviewed secret and hoping a later review catches it contradicts the product's safety claim. Sending raw evidence to an AI provider is never acceptable.

### Decision

1. Evidence bodies live only in private object storage. The database stores metadata, never raw evidence content.
2. Upload uses the two-step intent/finalize flow from ADR-004, but the presigned PUT writes to a quarantine prefix, not the active evidence prefix.
3. The client must provide a redaction step before upload:
   - images support masking or blackout;
   - text supports editing before submission.
   The platform states that client-side redaction cannot be independently guaranteed, which is why server checks and human review remain mandatory.
4. On finalize, the server:
   - verifies authentication, workspace access, scope, MIME type, size, and checksum;
   - runs an advisory scanner for secrets, tokens, credentials, personal data, and other sensitive patterns;
   - stores only finding categories and counts, never the matched values;
   - marks the evidence `QUARANTINED` if the scan flags content, otherwise `NOT_REVIEWED`.
5. A human reviewer resolves the record:
   - approve without change → `VERIFIED_SAFE`;
   - approve a sanitized replacement → `REDACTED`;
   - reject → the uploader must submit a replacement.
6. Redaction statuses become `NOT_REVIEWED`, `QUARANTINED`, `REDACTED`, `VERIFIED_SAFE`.
7. Only `REDACTED` and `VERIFIED_SAFE` evidence may:
   - be linked to a finding through `EvidenceLink`;
   - be included in AI context;
   - be included in a report revision or export.
   Pending and quarantined evidence is visible only to the uploader and workspace owner until resolved.
8. On approval, the server copies the object to the immutable active prefix, verifies the checksum, and deletes the quarantine object. Active objects are immutable; a content change creates a new evidence version under ADR-004 and requires review again.
9. Quarantine objects are encrypted, access-restricted, excluded from all AI and export paths, and purged within 24 hours of rejection or replacement.
10. The AI context manager passes only extracted, redacted text. It never sends binary objects, raw files, or quarantine content. Each task records the evidence IDs and versions used.
11. An approved evidence record with a later-discovered sensitivity issue is revoked, removed from AI/report eligibility, and superseded by a redacted version.

This interprets the PRD requirement as **redacted before activation**: a transient encrypted quarantine is not part of the accessible evidence library and is never processed by AI.

### Consequences

- Upload is slower and requires human review before evidence can support a finding.
- The evidence library must show review state prominently.
- The scanner is advisory and cannot be treated as a guarantee.
- AI prompts can cite evidence safely without exposing binaries.
- Report generation must exclude unapproved evidence even if a finding references it indirectly.

### Required document amendments (applied 2026-11-06)

- `PRD.md` §4.7: clarify "before storage" as "before activation", with quarantine rules. **Applied.**
- `DATABASE-SCHEMA.md` §3.11: add quarantine, scan, review, and activation fields; add `QUARANTINED`. **Applied.**
- `TECHNICAL-ARCHITECTURE.md` §10: describe the quarantine lifecycle and AI gate. **Applied.**
- `TECHNICAL-REQUIREMENTS.md` §7: add the redaction and activation endpoints. **Applied** as the finalize route plus a redaction-review Server Action, per ADR-009.
- `APP-FLOW.md` §11: describe client redaction, review, and rejection. **Applied.**

### Follow-ups

- Choose the scanning implementation and its false-positive policy (M-30).
- Define reviewer permissions when teams ship.
- Decide whether any automated redaction is offered, or only detection and human redaction.

---

## ADR-014 — Onboarding and personal-workspace provisioning

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-40

### Context

The flow redirects new users to onboarding, but no route, completion field, or provisioning trigger exists. ADR-001 requires a personal workspace from first access, and ADR-006 removes credential entry from onboarding.

### Decision

1. `Workspace` gains `kind`: `PERSONAL`, `TEAM`. A partial unique index enforces one `PERSONAL` workspace per `ownerId`.
2. Provisioning happens on the Clerk `user.created` webhook in one transaction:
   - upsert `User` keyed by `authProviderId`;
   - create the personal `Workspace`;
   - create `WorkspaceMember` with role `OWNER`;
   - write an audit event.
3. A lazy fallback, `ensureUserProvisioned()`, runs on the first authenticated request. It is idempotent and covers missed or replayed webhooks. Both paths use the same service.
4. `User` gains:
   - `onboardingCompletedAt` (nullable timestamp);
   - `onboardingVersion` (integer, default 1);
   - `researchInterests` (`ResearchInterest[]`).
   Existing `experienceLevel` and `preferredMode` are used.
5. `/onboarding` is a protected route in an `(onboarding)` group, outside the dashboard shell. Steps:
   - welcome and purpose;
   - experience level;
   - research interests (optional, at least none allowed);
   - preferred AI workflow;
   - AI usage, privacy, and limits disclosure (replaces credential entry);
   - finish.
6. Redirect rules:
   - authenticated and `onboardingCompletedAt` is null → `/onboarding`;
   - completed user visiting `/onboarding` → `/dashboard`;
   - unauthenticated → sign-in.
7. The finish action validates with Zod, requires experience level, preferred workflow, and disclosure acknowledgement, then sets `onboardingCompletedAt` and `onboardingVersion`, writes `USER_ONBOARDED`, and redirects.
8. Onboarding is submitted once; partial form state is not persisted. Abandoning the flow repeats it.
9. The personal workspace is named from the user's display name with a unique slug; rename is allowed later.
10. Account deletion propagation (Clerk `user.deleted`) remains governed by the retention decision (M-05).

### Consequences

- A user always has a workspace before onboarding, so no screen depends on a missing tenancy root.
- Webhook failure does not lock a user out.
- Onboarding can evolve by incrementing `onboardingVersion` without a schema migration.
- The old credential step is removed from the flow and documentation.
- Tests need a provisioning path that does not require a real Clerk webhook.

### Required document amendments (not yet applied)

- `APP-FLOW.md` §2–3: add provisioning and redirect rules; replace Step 5.
- `DATABASE-SCHEMA.md` §3.1–3.3: add onboarding fields and `Workspace.kind`.
- `TECHNICAL-ARCHITECTURE.md` §5: document the webhook and lazy fallback.
- `TECHNICAL-REQUIREMENTS.md` §4: add onboarding acceptance criteria.
- `PRD.md` §4.2: confirm the onboarding fields.

### Follow-ups

- Define the retention and anonymisation behaviour for deleted accounts (M-05).
- Decide whether onboarding interests feed recommendations or only copy.
- Define re-onboarding when `onboardingVersion` increases.

---

## ADR-015 — Duplicate detection and resolution

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-06

### Context

Duplicate detection is a stated PRD feature with no storage or technique. Comparing free-text titles at read time does not scale and cannot be reviewed consistently.

### Decision

1. `Finding.titleNormalized` is computed server-side on create and update:
   - Unicode NFKC;
   - lowercase;
   - punctuation removed;
   - whitespace collapsed and trimmed;
   - truncated to a fixed length.
2. PostgreSQL `pg_trgm` is enabled. A GIN index is created on `titleNormalized`, with a btree index on `(investigationId, vulnerabilityCategory)`.
3. Candidate query:
   - same investigation;
   - same vulnerability category when both are present;
   - `similarity(titleNormalized, candidate) >= 0.55`;
   - exclude the current finding;
   - return the top five by similarity.
4. Detection is advisory. It never merges records, changes status, or deletes anything automatically.
5. `Finding.duplicateOfId` is a nullable self-relation pointing at the canonical finding. The service:
   - rejects self-reference;
   - resolves a chain to its canonical root;
   - rejects cycles.
6. A human reviewer confirms a duplicate. Confirmation sets `duplicateOfId`, `duplicateConfirmedBy`, `duplicateConfirmedAt`, transitions the finding to `REJECTED`, and sets `resolutionReason = DUPLICATE`.
7. `Finding.resolutionReason` is an enum: `DUPLICATE`, `OUT_OF_SCOPE`, `INSUFFICIENT_EVIDENCE`, `OTHER`. It is required when a finding is `REJECTED`.
8. Duplicate findings remain in the investigation for history. Their evidence links remain. Reports exclude them.
9. The reviewer may dismiss candidates without recording a duplicate.
10. Embeddings and vector search are deferred. No `pgvector` dependency is added in the MVP.
11. The migration backfills `titleNormalized` before the index becomes required.

### Consequences

- Duplicate checks are fast and deterministic for the MVP.
- The threshold is a product tunable and must be evaluated against real findings.
- `REJECTED` gains a reason without adding another status to ADR-005.
- The UI must present candidates as suggestions, never as automatic decisions.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.10: add `titleNormalized`, `duplicateOfId`, duplicate confirmation fields, and `resolutionReason`.
- `DATABASE-SCHEMA.md` §8: add the trigram and category indexes.
- `PRD.md` §4.6: state that duplicate detection is advisory and human-confirmed.
- `APP-FLOW.md` §12: add candidate review and dismissal.

### Follow-ups

- Tune the similarity threshold with real data.
- Decide whether cross-investigation duplicate warnings are useful later.
- Define duplicate handling when the canonical finding is deleted.

---

## ADR-016 — Severity assessment and affected asset capture

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-07

### Context

The PRD requires severity assessment and an affected feature, but the schema has no severity rationale, assessor, or affected asset. Reportability cannot be reviewed consistently without them.

### Decision

1. Severity remains the manual enum `INFORMATIONAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `UNASSESSED`.
2. `Finding` gains:
   - `severityRationale` (text, required when severity is not `UNASSESSED`);
   - `severityAssessedBy` (user ID, nullable);
   - `severityAssessedAt` (timestamp, nullable);
   - `affectedAsset` (string);
   - `affectedAssetType` (the asset type enum).
3. Severity is set by a human. AI may propose a severity in task output or a verification review, but it never writes `Finding.severity`.
4. Every severity change updates the assessor, timestamp, and an audit event.
5. `affectedAsset` and `affectedAssetType` are required before a finding can be confirmed. They identify the specific feature, endpoint, host, or component affected within the investigation's target.
6. Confirmation preconditions become:
   - severity is not `UNASSESSED`;
   - severity rationale is present;
   - affected asset and type are present;
   - at least one `SUPPORTS` evidence link exists;
   - a human reviewer performs the transition.
7. Reportability additionally requires:
   - `impact` and `remediation` are present;
   - the report completeness checklist passes;
   - a human approves the report.
8. CVSS vectors, scores, and environmental scoring are deferred. No CVSS columns are added until a scoring method is decided.
9. UI labels map severity to the semantic design tokens. Severity is never conveyed by colour alone.

### Consequences

- Findings become reviewable and reportable on explicit criteria rather than prose alone.
- The confirmation guard grows beyond a status check into a readiness check.
- Researchers must record an affected asset earlier, which improves evidence traceability.
- AI severity suggestions remain advisory and auditable.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.10: add severity rationale, assessor, affected asset, and type.
- `PRD.md` §4.6: define the severity and affected-asset fields.
- `TECHNICAL-REQUIREMENTS.md` §5.6: add confirmation and reportability preconditions.
- `APP-FLOW.md` §12: add severity assessment and affected-asset capture.

### Follow-ups

- Decide whether CVSS is added later and in which form.
- Define severity guidance per vulnerability category.
- Add the readiness check to the finding domain contract and tests.

---

## ADR-017 — Target and scope field completion; derived authorization

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-16, and the materialisation question left open by ADR-003

### Context

Several required fields have no storage: the program URL, the authorization date, the scope attestation, and the authorization artifact. `Target.authorizationStatus` is also duplicated with `ScopeVersion.status`, and ADR-003 left open whether the target summary is computed on read or materialised.

### Decision

1. `Target` gains:
   - `programName` (optional);
   - `programUrl` (optional, validated as an `http(s)` URL);
   - `authorizationDate` (the date the user attests authorization was granted);
   - `authorizationNotes`.
   `authorizationSource` remains.
2. `Target.authorizationStatus` and `authorizationExpiresAt` are **materialised derived fields**. They are recomputed:
   - transactionally when a scope version is created, activated, superseded, revoked, or expired;
   - by a daily expiry job;
   - during the Phase 2 backfill.
3. Derivation uses the latest scope version by version number:
   - no scope, or only `DRAFT` → `UNVERIFIED`;
   - `REVOKED` → `REVOKED`;
   - `ACTIVE` with `effectiveFrom` in the future → `PENDING`;
   - `ACTIVE` within its window → `AUTHORIZED`;
   - `ACTIVE` past `effectiveUntil`, or `EXPIRED` → `EXPIRED`;
   - `SUPERSEDED` with no newer active version → `UNVERIFIED`.
   `authorizationExpiresAt` mirrors the active scope's `effectiveUntil`; otherwise it is null.
4. The target summary is a cache. The action-time scope validator recomputes from `ScopeVersion`, `ScopeAsset`, `ScopeActivityRule`, and the current clock. A stale cached status never grants access.
5. `ScopeVersion` gains:
   - `approvedBy` and `approvedAt` (the self-attestation record);
   - `attestationNotes`;
   - `supersededAt`.
   `approvedBy`, `approvedAt`, `effectiveFrom`, and `effectiveUntil` are required before a version can become `ACTIVE`.
6. A partial unique index enforces at most one `ACTIVE` scope version per target. `SUPERSEDED` is a real status, not a deletion.
7. `AuthorizationArtifact` becomes a first-class model:
   - `id`
   - `scopeVersionId`
   - `storageKey`
   - `fileName`
   - `mimeType`
   - `fileSize`
   - `checksum`
   - `uploadedBy`
   - `createdAt`
   Artifacts live in private storage, are access-checked like evidence, and are never sent to AI or included in report exports.
8. `ScopeVersion.authorizationEvidenceId` is removed in favour of `AuthorizationArtifact`. Authorization documents are not `Evidence` and are not linked through `EvidenceLink`.
9. Every status change on a target or scope writes an audit event. Expiry notification and re-attestation remain follow-ups.

### Consequences

- Target lists and dashboards can filter by authorization status without recomputing every row.
- The daily job is required; without it, cached status drifts until the next scope change.
- The action-time validator remains the security boundary, so a stale cache cannot authorize activity.
- Authorization artifacts are isolated from the evidence library and its AI rules.
- Scope versions are append-only in practice: they are status-managed, not deleted.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.5: add program, attestation, and materialised status fields.
- `DATABASE-SCHEMA.md` §3.6: add approval, supersession, and artifact relations; remove the evidence pointer.
- `DATABASE-SCHEMA.md` §7–8: add the partial unique active-scope index and expiry indexes.
- `TECHNICAL-ARCHITECTURE.md` §9: document materialisation and the action-time recomputation rule.
- `APP-FLOW.md` §6–7: add program details, attestation, and artifact upload.
- `PRD.md` §4.3–4.4: state that authorization is self-attested and target status is derived.

### Follow-ups

- Define the expiry notification and re-attestation flow.
- Decide the artifact size limits and storage lifecycle.
- Decide whether target status changes emit domain events for dashboards.

---

## ADR-018 — Vercel, Neon, and pooled Prisma connections

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-28

### Context

The database document names Neon, the architecture says managed PostgreSQL, and serverless functions need connection pooling. No deployment target or Prisma connection strategy was defined.

### Decision

1. Vercel hosts the Next.js application for the MVP.
2. PostgreSQL is Neon, with a single primary region co-located with the Vercel functions. The exact region is recorded at deployment and remains subject to the data-residency decision (M-38).
3. Prisma uses two connection strings:
   - `DATABASE_URL` — pooled Neon connection used by the application at runtime;
   - `DIRECT_URL` — direct connection used only for migrations and introspection.
4. The datasource declares `url = env("DATABASE_URL")` and `directUrl = env("DIRECT_URL")`. Request handlers never read `DIRECT_URL`.
5. Pooled connections use `sslmode=require` and the Neon pooler. Prisma runs with a single client singleton per process; no per-request clients.
6. Routes, Server Actions, and services that touch the database, storage, or AI run on the Node.js runtime. The Edge runtime is not used for those paths in the MVP.
7. Production, staging, and preview use separate Neon databases or branches. Preview deployments never point at production data.
8. CI applies migrations with `prisma migrate deploy` against a clean database. `prisma migrate dev` is never run against production.
9. Neon point-in-time restore is the backup mechanism. The retention window is documented in the deployment runbook and aligned with M-05.
10. Multi-region reads, read replicas, and database-level sharding are out of scope for the MVP.

### Implementation note — Prisma 7

Prisma 7 no longer accepts `url`/`directUrl` inside the schema when the CLI reads a config file. The
equivalent split is:

- `prisma7.config.ts` sets `datasource.url` to `DIRECT_URL ?? DATABASE_URL` for migration and
  introspection commands;
- `src/lib/db.ts` passes `DATABASE_URL` to `PrismaPg` at runtime.

The intent of items 3–4 is unchanged; only the configuration surface differs.

### Consequences

- Serverless connection exhaustion is avoided without a custom pooler.
- Migrations have a dedicated path and cannot accidentally run through PgBouncer.
- The deployment is coupled to Vercel and Neon, but the application only depends on standard PostgreSQL and Prisma.
- Preview data isolation must be configured in the hosting provider, not left to developers.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §1: record Neon, pooled runtime URL, and direct migration URL.
- `TECHNICAL-ARCHITECTURE.md` §18: name Vercel and Neon, and document environment separation.
- `TECHNICAL-REQUIREMENTS.md` deployment section: add the pooling and migration rules.

### Follow-ups

- Choose and document the deployment region (M-38).
- Define the backup and restore runbook.
- Decide whether preview deployments use Neon branches or a shared staging database.

---

## ADR-019 — Cloudflare R2 private object storage and upload constraints

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-29; records the MVP position on M-30

### Context

Evidence and authorization artifacts require private object storage with presigned uploads and downloads. The architecture specifies an S3-compatible provider but names no vendor or limits. The product accepts untrusted files, so upload constraints are security controls.

### Decision

1. Object storage is a private Cloudflare R2 bucket accessed through the S3-compatible API.
2. The bucket has no public access and no public object URLs. All access is through short-lived signed URLs after a server-side authorization check.
3. Environment variables remain the S3-compatible set:
   - `STORAGE_ENDPOINT`
   - `STORAGE_REGION` (`auto` for R2)
   - `STORAGE_BUCKET`
   - `STORAGE_ACCESS_KEY_ID`
   - `STORAGE_SECRET_ACCESS_KEY`
4. Presigned PUT and GET URLs expire after five minutes. Evidence files are limited to 25 MB. Authorization artifacts are limited to 10 MB. Multipart upload is deferred.
5. The MIME allowlist is:
   - `image/png`, `image/jpeg`, `image/webp`
   - `application/pdf`
   - `text/plain`, `text/csv`
   - `application/json`, `application/xml`, `text/xml`
   - `application/x-ndjson`
   Anything else is rejected at upload intent.
6. The server sniffs magic bytes on finalize and rejects a mismatch between the declared and detected type. The detected type is stored.
7. The server computes a SHA-256 checksum after upload, compares it with the client-provided value, and stores it. A mismatch rejects the evidence.
8. Keys are separated:
   - `quarantine/{workspaceId}/{evidenceId}/{uploadId}`
   - `evidence/{workspaceId}/{investigationId}/{evidenceId}/v{version}`
   - `authorization/{workspaceId}/{scopeVersionId}/{artifactId}`
9. Active objects are immutable. The application never overwrites an object; corrections create a new version with a new key under ADR-004 and ADR-013.
10. Signed downloads use `Content-Disposition: attachment` for PDFs, text, JSON, XML, CSV, and archives. Images may render inline. HTML and SVG are not accepted.
11. Quarantine objects are deleted within 24 hours of rejection or replacement. A bucket lifecycle rule enforces the purge.
12. Malware scanning is deferred for the MVP. Compensating controls are: no execution, no HTML/SVG, MIME allowlist, magic-byte validation, size limits, private storage, signed downloads, and quarantine. Scanning must be revisited before public or multi-tenant launch.
13. The storage adapter is an interface. Switching to AWS S3 or another S3-compatible provider must not change domain or application code.
14. R2 credentials are scoped to the bucket and separated per environment.

### Consequences

- Evidence downloads do not incur egress charges.
- The application depends only on the S3 API, not R2-specific features.
- The MVP accepts a documented malware risk in exchange for faster delivery.
- Image and PDF handling must be treated as untrusted at every layer.

### Required document amendments (applied 2026-11-06)

- `TECHNICAL-REQUIREMENTS.md` file storage section: record R2, limits, allowlist, and sniffing. **Applied.**
- `TECHNICAL-ARCHITECTURE.md` §10 and §15: add the key scheme and storage variables. **Applied.**
- `DATABASE-SCHEMA.md` §3.11: reference the quarantine and active key split. **Applied.**
- `APP-FLOW.md` §11: add the size, type, and rejection behaviour. **Applied.**

### Follow-ups

- Decide the malware scanning provider before public launch (M-30).
- Define image dimension and decompression-bomb limits.
- Decide whether preview deployments use a separate bucket.

---

## ADR-020 — Upstash Redis for rate limiting

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-31

### Context

Serverless instances cannot share in-memory counters. Authentication, AI, uploads, and exports need burst protection, while per-user AI token budgets need an authoritative ledger. The architecture discourages introducing Redis before it is justified.

### Decision

1. Rate-limit counters live in Upstash Redis and are accessed through the HTTP REST API.
2. Environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Burst limits use a sliding window. Daily quotas use a fixed window. The AI token budget is enforced by a PostgreSQL usage ledger, not by Redis.
4. Keys include environment, action, identity, and window. Identity is the user ID for authenticated actions and the IP address for pre-authentication actions.
5. Initial defaults:
   - AI task creation: 10 per minute and 100 per day per user;
   - upload intent: 20 per minute and 200 per day per user;
   - report export: 5 per minute per user;
   - provisioning fallback: 10 per minute per IP;
   - Clerk webhook: 300 per minute per IP after signature verification;
   - other authenticated mutations: 30 per minute per user.
   All limits are constants in one module and may be tuned without a schema change.
6. Failure policy:
   - AI, upload, export, and provisioning fail closed when the limiter is unavailable;
   - read-only paths fail open with a structured warning.
   Never allow AI or uploads because Redis is unreachable.
7. An in-memory limiter is permitted only in development and tests. Production startup asserts that Upstash is configured.
8. A limited request returns `429` with `Retry-After`. The response does not reveal internal limits or identities.
9. Security-sensitive denials are audit-logged. Routine throttling is counted, not logged per request.
10. The daily AI token cap remains authoritative in PostgreSQL even when Redis is healthy. Redis protects burst and abuse; it is not billing truth.

### Consequences

- A managed dependency is added for a real serverless constraint.
- Rate limiting adds a few milliseconds to protected paths.
- Fail-closed behaviour can surface an outage as a temporary denial, which is preferable to unbounded AI or upload usage.
- Tests need a deterministic limiter double.

### Required document amendments (not yet applied)

- `TECHNICAL-ARCHITECTURE.md` §9 and §15: name Upstash and the protected paths.
- `TECHNICAL-REQUIREMENTS.md` §7: add rate-limit requirements.
- `AI-ARCHITECTURE.md` budgets section: distinguish burst limits from token budgets.

### Follow-ups

- Tune limits after real usage data exists.
- Decide whether IP-based limits are reliable behind the chosen proxy configuration.
- Define alerting for sustained throttling.

---

## ADR-021 — CI, test database, and deterministic AI mock

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-33

### Context

The repository now has GitHub Actions, but the plan did not define a test database strategy, integration-test isolation, or how AI behaviour is tested deterministically without live provider calls.

### Decision

1. GitHub Actions is the CI system.
2. The quality job runs formatting, lint, typecheck, unit tests, and a production build.
3. The integration job uses a PostgreSQL 17 service container with a `TEST_DATABASE_URL`. It applies migrations with `prisma migrate deploy` and verifies that the schema builds from scratch.
4. Integration tests run serially against one database. Each test runs inside a transaction that is rolled back; suites that cannot use a transaction truncate explicitly in dependency order.
5. Integration tests never use Neon and never use production credentials.
6. The end-to-end job runs against a production build served by `next start`, not the development server. Playwright reports are uploaded on failure.
7. Once authentication lands, e2e uses a dedicated Clerk development instance with `@clerk/testing`. There is no application-level authentication bypass in production builds.
8. AI tests inject a deterministic `MockAIProvider` through the provider interface. The mock covers:
   - valid structured output;
   - malformed JSON;
   - schema validation failure;
   - timeout;
   - provider rate limit;
   - budget exceeded;
   - refusal;
   - prompt-injection input.
9. The mock is selected by test composition only. An environment variable cannot switch a production build to the mock provider silently.
10. CI never calls Anthropic or any target network. Live model evaluation is a separate, manual or scheduled workflow (M-25).
11. Node 22, PostgreSQL 17, and Yarn 1.22.22 are pinned. Dependency installation uses the committed lockfile.
12. Preview deployments may use Neon branches later; CI remains self-contained.

### Consequences

- Database constraints, migrations, and transaction behaviour are tested for real.
- CI is slower than an in-memory database but catches failures that mocks cannot.
- Serial integration tests limit parallelism; this is acceptable at the current suite size.
- AI error handling becomes testable before any provider call exists.

### Required document amendments (not yet applied)

- `IMPLEMENTATION-PLAN.md` §4 and QA phase: add the database and AI mock strategy.
- `TECHNICAL-ARCHITECTURE.md` §17: document integration-test isolation.
- `TECHNICAL-REQUIREMENTS.md` testing section: add deterministic AI requirements.

### Follow-ups

- Add the PostgreSQL service and integration-test project when Prisma lands.
- Define coverage thresholds.
- Add the Clerk test-instance setup in Phase 2.

---

## ADR-022 — Secrets management and deferred BYOK encryption

**Status:** Accepted
**Date:** 2026-11-03
**Resolves:** M-35

### Context

The schema reserves an encrypted credential reference for a future bring-your-own-key model, but the MVP uses a platform-owned AI key. No mechanism was defined for secret storage, least privilege, rotation, or future envelope encryption.

### Decision

1. Secrets live in Vercel environment variables, scoped per environment. Production values are marked sensitive in the hosting provider.
2. Local secrets live in `.env.local`. `.env.example` contains names and safe placeholders only. Secrets are never committed.
3. Least privilege:
   - Neon has a runtime application role and a separate migration role;
   - `DIRECT_URL` is available only to migration and deployment contexts;
   - the R2 token is scoped to the bucket;
   - the Upstash token is scoped to the application database;
   - Clerk keys are separate per environment.
4. Startup validates the environment and fails fast in production when required values are missing. Secrets are read lazily, not baked into the build.
5. Secrets are never logged, serialized, included in AI prompts, returned in errors, or placed in `NEXT_PUBLIC_*` variables. Only publishable values may be public.
6. Rotation:
   - the AI platform key, Clerk secret, database credentials, R2 credentials, and Upstash token are rotatable without code changes;
   - a compromised credential is rotated immediately and the incident is recorded;
   - rotation ownership is documented in the deployment runbook.
7. Secret scanning runs in CI with GitHub push protection and a `gitleaks` job. A detected secret fails the build.
8. BYOK remains deferred. `AIProviderConfig.encryptedCredentialReference` stays null in the MVP.
9. When BYOK is introduced, it uses envelope encryption:
   - AES-256-GCM per-workspace data keys;
   - a KMS-managed master key (AWS KMS or equivalent);
   - a stored key version and rotation procedure;
   - no plaintext credential ever reaches the database, logs, or browser.
10. Database and object storage encryption at rest are enabled. Backups inherit provider encryption.
11. Production secret access is limited to deployment and administrative roles; access is reviewed periodically.

### Consequences

- There is no self-hosted vault to operate.
- Platform configuration is the source of truth for secrets, with no second copy in the repository.
- BYOK remains a deliberate future project rather than a partially built feature.
- Secret scanning adds a CI failure mode that must be kept free of false positives.

### Required document amendments (not yet applied)

- `TECHNICAL-ARCHITECTURE.md` §15: add the provider, least-privilege, and rotation rules.
- `DATABASE-SCHEMA.md` §4.1: mark the credential field as reserved and unused.
- `TECHNICAL-REQUIREMENTS.md` security section: add secret-scanning and rotation requirements.

### Follow-ups

- Choose the KMS provider when BYOK is scheduled.
- Define the incident response procedure for leaked credentials.
- Add `gitleaks` to the CI workflow.











## ADR-023 — Onboarding is deferred; first authenticated access provisions the workspace

**Status:** Accepted
**Date:** 2026-11-04
**Amends:** ADR-014 (steps 5–7 only)

### Context

ADR-014 defines an `/onboarding` group, a completion flag, and redirect rules. Phase 3
builds projects, targets, and scope, not the onboarding questionnaire. Implementing the
questionnaire in the same slice would add steps that no current feature consumes, while
withholding the dashboard until it is complete would block the phase's own workflow.

### Decision

1. Clerk is wired for sign-in and sign-up (ADR-002), and provisioning runs from the
   `user.created` / `user.updated` webhook and the lazy `getSessionContext()` fallback.
2. `User.onboardingCompletedAt` remains nullable and is not set by provisioning.
3. The dashboard is reachable immediately after provisioning. No `/onboarding` routes are
   added in Phase 3.
4. The onboarding questionnaire, its redirect rules, and `USER_ONBOARDED` audit event stay
   scheduled (ADR-014) but are not implemented.
5. Authentication stays server-side: proxy protection is a convenience, and every page and
   Server Action re-resolves the workspace through `getSessionContext()`.

### Consequences

- A new user reaches the project workflow without a questionnaire step.
- ADR-014 step 5–7 acceptance criteria remain open.
- When onboarding ships, adding the redirect is a route-level change, not a schema change.

### Required document amendments (not yet applied)

- `APP-FLOW.md` §2–3: record the temporary post-sign-in destination.
- `TECHNICAL-ARCHITECTURE.md` §5: mark onboarding as deferred.

### Follow-ups

- Implement the onboarding steps and redirect rules from ADR-014.
- Decide whether existing users are re-onboarded when `onboardingVersion` increases.

---

## ADR-024 — Investigation creation authorization, lifecycle, and manual summaries

**Status:** Accepted
**Date:** 2026-11-06
**Resolves:** Phase 4 investigation lifecycle gaps

### Context

Phase 4 adds investigations, observations, hypotheses, and session summaries. The source documents require an investigation to reference an authorized target but do not say whether the target must have an active scope before an investigation record may be created. They also define investigation statuses without transitions, and session summaries without saying whether Phase 4 may create them before the AI orchestrator exists.

### Decision

1. An investigation may be created against any target registered in the same workspace and project. An active scope is not required to create the investigation record.
2. The active scope remains the sole authority for target-touching capabilities (ADR-003, ADR-007). Creating, editing, or reviewing an investigation does not authorize any network or target action.
3. Archived projects reject new investigations and edits to existing investigations.
4. Investigation statuses and transitions are:
   - `DRAFT → ACTIVE | ARCHIVED`
   - `ACTIVE → PAUSED | UNDER_REVIEW | COMPLETED | ARCHIVED`
   - `PAUSED → ACTIVE | ARCHIVED`
   - `UNDER_REVIEW → ACTIVE | COMPLETED | ARCHIVED`
   - `COMPLETED → ARCHIVED`
   - `ARCHIVED` is terminal.
5. Entering `ACTIVE` for the first time sets `startedAt`; entering `COMPLETED` sets `completedAt`; later pauses and resumes preserve both timestamps.
6. Phase 4 session summaries are manual (`generatedByType = HUMAN`). AI-generated summaries remain Phase 5 work and must carry model and prompt provenance when added.
7. Hypothesis-to-observation links use `HypothesisObservation` with `SUPPORTS`, `CONTRADICTS`, or `CONTEXT`, per ADR-011. Hypothesis status transitions follow ADR-005.

### Consequences

- Researchers can document an investigation before scope activation without weakening the action-time scope gate.
- Status transitions are testable and cannot skip directly from `DRAFT` to `COMPLETED`.
- Manual summaries provide continuation context without pretending an AI generated them.
- Observations and hypotheses stay inside the workspace and investigation that own them.

### Required document amendments (not yet applied)

- `DATABASE-SCHEMA.md` §3.7: record investigation transitions and timestamp rules.
- `APP-FLOW.md` §8: state that investigation creation requires a registered target, not an active scope.
- `TECHNICAL-ARCHITECTURE.md` §20, Phase 4: note manual-only summaries for the phase.

---

## ADR-025 — AI execution pack: structured output, budgets, prompts, injection defence, and provider surface

**Status:** Accepted
**Date:** 2026-11-06
**Resolves:** M-19, M-20, M-21, M-23, M-24, M-25, M-26, M-27

### Context

Phase 5 integrates Anthropic Claude and the AI orchestration foundation. The source documents require structured output, token budgets, versioned prompts, prompt-injection defence, streaming/background execution, deterministic evaluation, context compression, and a provider abstraction, but leave the concrete choices open. ADR-006 fixes the platform-owned key and mandatory usage enforcement; ADR-007 fixes the capability and approval gate; ADR-021 fixes the deterministic mock-provider test strategy.

### Decision

1. **Structured output (M-19).** Structured tasks use Anthropic tool use with a JSON schema, followed by Zod re-validation. A single corrective retry is allowed. A second failure marks the task `FAILED` with a stable validation error. Invalid output is never stored as a confirmed observation, hypothesis, finding, or summary.
2. **Models and budgets (M-20).** The platform uses Sonnet-class models for research, recon, and verification tasks and Haiku-class models for summaries and classification. Model IDs are server-side configuration with safe defaults (`claude-sonnet-4-5` and `claude-haiku-4-5`) and may be overridden per environment without code changes.
   - Research and verification: 60,000 input tokens and 4,000 output tokens per task.
   - Recon and hypothesis generation: 40,000 input tokens and 3,000 output tokens per task.
   - Session summaries and classification: 30,000 input tokens and 2,000 output tokens per task.
   - Default daily cap: 250,000 total tokens per user. The cap is checked against PostgreSQL task usage before the provider call and returns `AI_BUDGET_EXCEEDED` when the next task cannot fit.
3. **Prompts (M-21).** Prompts are versioned TypeScript modules in the repository. Each prompt has a stable ID, version, purpose, safety restrictions, and a SHA-256 content hash. Every AI task records the prompt ID, version, and content hash. Database prompt overrides are deferred.
4. **Prompt-injection defence (M-23).** Untrusted project, target, observation, hypothesis, and evidence text is delimited and labelled as data. The system prompt establishes an instruction hierarchy: platform rules override user text, and content inside delimiters is never an instruction. MVP assistants have no tools or network capabilities; the structured-output tool is not an action tool. Output schemas, size limits, and evidence-reference checks remain mandatory. The evaluation corpus includes injection attempts.
5. **Streaming and timeouts (M-24).** Chat responses stream through a server Route Handler. Structured tasks that fit inside the request budget run synchronously through Server Actions and may later move to a background runner with polling. A provider timeout marks the task `TIMED_OUT`; it does not leave a partial assistant message as valid output.
6. **Evaluation (M-25).** CI uses the deterministic `MockAIProvider` selected by composition only. Fixtures cover valid output, malformed JSON, schema failure, timeout, provider rate limit, budget exhaustion, refusal, and prompt injection. Live Anthropic evaluation remains manual or scheduled and never runs in CI.
7. **Context compression (M-26).** Context assembly is bounded. When estimated input reaches 60% of the task input budget, the manager keeps the investigation summary, the newest session summary, open hypotheses, and the most recent conversation turns, and drops older low-priority records. The compression decision is recorded in task metadata.
8. **Provider surface (M-27).** The MVP exposes Anthropic only. The provider interface remains multi-provider ready, but users cannot switch providers or enter credentials. `AIProviderConfig.encryptedCredentialReference` stays unused per ADR-006 and ADR-022.
9. **Human authority.** AI output is advisory. AI may create observations only after human review; it may not change scope, authorize targets, confirm findings, set severity, or mark findings reportable. These rules are enforced in application services, not prompts.
10. **Traceability.** Every task records provider, model, prompt ID/version/hash, context version, capability requirements, token budgets and usage, failure code, timestamps, and requester. Every assistant message records usage where available.

### Consequences

- AI behaviour is testable without network calls and without a production key.
- Budget exhaustion fails closed instead of silently truncating evidence or switching models.
- Prompt changes remain reproducible through versions and content hashes.
- The first Phase 5 slice can ship a single provider while preserving future portability.
- Verification against real findings remains blocked until the Phase 6 finding workflow lands; the AI service can still validate and persist a verification task when a finding exists.

### Required document amendments (not yet applied)

- `AI-ARCHITECTURE.md` §8–§12: record the concrete model classes, budgets, prompt hash rule, and compression threshold.
- `TECHNICAL-ARCHITECTURE.md` §8 and §20 Phase 5: record the provider interface, streaming route, and task budget enforcement.
- `TECHNICAL-REQUIREMENTS.md` §10: add the AI error codes and budget rules.
- `DEVELOPMENT-READINESS-REPORT.md` §4.3: mark M-19–M-27 accepted by ADR-025.

---

## ADR-026 — Editorial Research Console visual system and interface redesign

**Status:** Accepted
**Date:** 2026-11-06
**Authority:** User approval of the design audit and incremental redesign proposal.

### Decision

1. Replace the initial dark SaaS visual direction with a light-first Editorial Research Console. Use Swiss alignment, editorial typography, open research sections, restrained dividers, and structured record tables.
2. Use the approved paper palette: background `#F4F2EC`, main surface `#FBFAF7`, elevated surface `#FFFFFF`, primary text `#191B1E`, border `#DCDAD3`, and primary accent `#3659A8`.
3. Use `#666A70` for small secondary text on paper because the brief's `#73777C` falls below AA there. Retain `#73777C` for suitable text on white. Input boundaries use a stronger neutral for non-text contrast.
4. Use Source Serif 4 for display headings, existing Inter for the interface, and existing JetBrains Mono for technical references and timestamps. Avoid decorative labels, excessive icons, pills, and metric cards.
5. Preserve the Workspace, Research, and Account navigation groups and the existing routes. Mobile navigation and assistant drawers must support keyboard focus management and reduced motion.
6. Compose the dashboard around actual investigations, project attention, recorded activity, validation counts, and saved session next actions. Distinguish empty data, unavailable features, loading, and errors.
7. Compose investigations as a context rail, research document, and optional assistance panel. Explicitly distinguish researcher records, original evidence, AI interpretations, and human decisions. AI interfaces reflect provider availability; they never simulate results or confirmation.
8. Preserve database models, API and Server Action contracts, tenancy and authorization checks, immutable evidence rules, and human verification authority. This decision authorizes frontend redesign, not new provider, storage, or target-touching capabilities.
9. Implement incrementally and verify every page, relevant form flows, responsive states, keyboard access, and the repository's required checks.

### Document amendments

- `DESIGN-BRIEF.md` is updated to version 2.0 with the approved visual system.
- Older phase summaries in `CLAUDE.md` and `ENGINEERING.md` remain historical; accepted ADRs and `PROJECT-STATUS.md` describe implemented functionality.

---

## ADR-027 — Report PDF export and report template management

**Status:** Accepted
**Date:** 2026-11-06
**Resolves:** M-37 and the ADR-008 template/PDF follow-ups

### Context

ADR-008 makes Markdown the canonical report format and requires a versioned template model. It leaves two implementation gaps: the PDF renderer used by M-37, and the policy for selecting and managing system and workspace templates. Reports must remain human-approved, immutable per revision, and free of AI-authored content.

### Decision

1. **PDF is a derived export.** The canonical report format remains the Markdown stored in the approved `ReportRevision`. A PDF export renders that exact revision content and never mutates the report, finding, evidence, or template records.
2. **PDF renderer.** PDF generation uses `pdf-lib` in the Node.js runtime. It is a deterministic, in-process Markdown renderer: non-AI, no network access, no headless browser, and no external rendering worker. It supports headings, paragraphs, bullet lists, blockquotes, horizontal rules, code blocks, A4 page breaks, standard embedded PDF fonts, metadata, and page footers. Characters outside the standard font encoding are replaced rather than failing the export.
3. **Export formats.** Both `MARKDOWN` and `PDF` are valid report exports. Either is available only when a report is `APPROVED` or `EXPORTED`. The first export records `REPORT_EXPORTED`, moves the report to `EXPORTED`, and records the format and filename. Re-downloading an exported report is read-only and does not create another audit event.
4. **Templates are versioned by name.** System templates are seeded by migration and are read-only. Workspace templates are created and activated or deactivated by `OWNER` or `ADMIN`; creating another template with the same name saves the next version. A deactivated template cannot be selected for a new report. Existing reports keep their `templateId` and the rendered revision content.
5. **Required sections are protected.** Every template includes `summary`, `findings`, `evidence`, `assumptions`, and `missing-information`, so reports always label findings, approved evidence, assumptions, and gaps separately. Templates may add `methodology` and `recommendations` and control the section order. Template changes never rewrite historical revisions.
6. **Readiness is template-independent.** Submission and approval continue to re-check confirmed/reportable status, severity and rationale, affected asset and type, impact, remediation, and supporting approved evidence. Selecting a template cannot bypass report readiness.

### Consequences

- PDF export works on Vercel without a browser worker or additional infrastructure.
- Generated PDFs are intentionally basic and semantic; pixel-perfect PDF fidelity remains out of scope.
- Markdown stays the canonical, diffable, re-exportable artefact.
- System templates require `prisma migrate deploy`; the migration is idempotent by fixed template ID.
- Workspace template management is an owner/administrator action and is audited.
- The standard PDF fonts limit non-Latin glyph support until a font-embedding strategy is adopted.

### Required document amendments

- `TECHNICAL-REQUIREMENTS.md` §5.8: record PDF export via the deterministic server-side renderer and the template management policy.
- `PRD.md` §4.9: note that PDF is a derived basic export and Markdown remains canonical.
- `DEVELOPMENT-READINESS-REPORT.md` M-37: mark PDF export resolved by ADR-027.
- `DATABASE-SCHEMA.md` §5: note that system templates are seeded read-only and workspace templates are versioned by name.
