# SENTINEL RESEARCH
# Development Readiness Report

**Date:** 3 November 2026
**Review type:** Documentation and architecture review (no implementation)
**Scope:** All 8 Markdown documents in `docs/` — 5,914 lines total
**Repository state:** Documentation only. No `package.json`, Prisma schema, source tree, environment file, or Git repository exists yet.
**Change policy:** No product requirement or architecture document was modified. Every resolution in this report is a **proposal requiring sign-off**. Nothing here overrides the PRD or the architecture.

---

> **Status update — 3 November 2026.** Ten blocking decisions (ADR-001 to ADR-010), the seven
> schema-pack decisions (ADR-011 to ADR-017), and the five platform decisions (ADR-018 to ADR-022)
> have been accepted and recorded in `docs/DECISIONS.md`. The foundation slice is implemented:
> Next.js scaffold, CI, design tokens, application shell, environment contract, and executable
> domain contracts with 53 unit tests, 11 PostgreSQL integration tests, and a Playwright shell
> suite. The Prisma schema, initial migration, and PostgreSQL integration harness now exist. Authentication, AI, and evidence storage
> remain deliberately unimplemented. The AI pack (structured output, budgets, prompts, streaming,
> evaluation) still gates Phase 4.

---

## 1. Executive Summary

**Verdict: NO-GO for feature implementation. CONDITIONAL GO for the foundation slice.**

The documentation is unusually strong on product intent, safety principles, and phased sequencing. The core proposition — persistent investigation memory, evidence-based verification, and human authority — is coherent across all eight documents. The safety posture is consistent: no autonomous exploitation, no automatic confirmation, no AI control of authorization.

However, the documents are not yet an implementable specification. This review found:

- **17 cross-document conflicts**, of which **10 block the module they touch**.
- **43 undecided technical choices**, several of which affect the schema and cannot be deferred safely.
- **1 PRD acceptance criterion that is currently unverifiable** (criterion 13, unauthorized actions), because the MVP defines no target-touching action to gate.
- **1 direct contradiction** between the entity-relationship diagram and the workspace-isolation rule that every query depends on.

None of these invalidates the product. They are specification decisions, not design flaws. The architecture is broadly capable of supporting the PRD; the gaps are in precision, not direction.

### Top blockers

| # | Blocker | Consequence if unresolved |
|---|---|---|
| 1 | Workspace ownership model contradicts the ERD and the route structure | Every repository query and authorization check is built on an ambiguous tenancy root |
| 2 | Finding status vocabulary differs between PRD and schema | Status transitions, UI, verification, and reporting cannot be implemented consistently |
| 3 | Four incompatible AI task state machines | AI task persistence, retries, UI states, and audit events will diverge |
| 4 | AI and human verification conclusions share one enum, and AI may emit `CONFIRMED` | Violates the PRD rule that AI cannot confirm a finding |
| 5 | Two incompatible evidence models and two upload contracts | Evidence cannot be stored, scoped, versioned, or linked consistently |
| 6 | Target authorization has two sources of truth and no verification model | Scope enforcement has no deterministic answer to "is this action allowed?" |
| 7 | AI credential ownership is undecided (per-user BYOK vs platform key) | Onboarding, cost model, secrets handling, and `AIProviderConfig` all change |
| 8 | Authentication provider is undecided (Clerk vs Auth.js) | Blocks the first external dependency and user-sync design |
| 9 | Delegated-mode capabilities are undefined | The main safety acceptance criterion cannot be tested |
| 10 | Scope authorization evidence has a circular dependency | Scope records cannot reference their authorization artifact without violating evidence constraints |

### What is strong

- The product's differentiators are clearly stated and consistently protected: human approval, evidence traceability, persistent context, and false-positive reduction.
- The modular-monolith decision is appropriate for the stage and is stated consistently.
- Safety prohibitions are repeated consistently across PRD, TRD, technical architecture, and AI architecture.
- The implementation phases are broadly coherent and incremental.
- The design brief is specific enough to produce a distinctive interface without inventing a visual language.
- The database design correctly separates observations, AI inference, evidence, and human approval in principle (DB §11).

### Recommended path

1. **Ratify the 10 blocking decisions** in Section 10. This is a product/engineering decision session, not coding.
2. **Execute the foundation slice** in Section 9, which is deliberately independent of those decisions except for the canonical status enums.
3. **Then** model the database and integrate authentication.

Do not start with Prisma modeling, authentication integration, or AI calls. Those three areas carry most of the unresolved decisions.

---

## 2. Review Method and Document Inventory

All eight documents were read in full, then cross-checked for shared entities, enums, routes, ownership rules, lifecycle states, and phase ordering. Findings are based on explicit text, not inference. Where a document is merely less detailed than another, it is recorded as a gap rather than a conflict.

### Document inventory

| Document | Version / Status | Role | Internal consistency |
|---|---|---|---|
| `PRD.md` | 1.0 / Initial Product Specification | Product source of truth | Strong narrative; status vocabulary drifts from schema |
| `TECHNICAL-REQUIREMENTS.md` | 1.0 / Initial Technical Specification | Technical baseline | Strong module list; API and AI contracts drift from architecture |
| `APP-FLOW.md` | 1.0 | User journeys and states | Mostly consistent; onboarding route is missing from routes |
| `DATABASE-SCHEMA.md` | 1.0 | Data model source of truth (per TA §6.4) | Strong principles; several fields and join models missing |
| `TECHNICAL-ARCHITECTURE.md` | 1.0 / Development Blueprint | Architecture source of truth | Most detailed; contains a competing evidence and task model |
| `AI-ARCHITECTURE.md` | 1.0 / Initial Architecture Specification | AI orchestration source | Strong safety model; lifecycle and conclusion enums drift |
| `IMPLEMENTATION-PLAN.md` | 1.0 / Initial Development Roadmap | Sequencing | Broadly aligned with TA; phase labels differ |
| `DESIGN-BRIEF.md` | 1.0 | UI/UX direction | Consistent with PRD; no component-level contract for AI/human distinction |

**Citation legend:** PRD = `PRD.md`; TRD = `TECHNICAL-REQUIREMENTS.md`; FLOW = `APP-FLOW.md`; DB = `DATABASE-SCHEMA.md`; TA = `TECHNICAL-ARCHITECTURE.md`; AIA = `AI-ARCHITECTURE.md`; PLAN = `IMPLEMENTATION-PLAN.md`; DESIGN = `DESIGN-BRIEF.md`.

### Assumptions and limits

- This review treats the PRD as the product source of truth and DB as the data-model source of truth, as TA §6.4 instructs. Where those two disagree, the conflict is escalated rather than resolved silently.
- No code exists, so this is a documentation-readiness review, not a code audit.
- Legal, privacy, and contractual review are outside this review. They are flagged where relevant.
- Effort estimates are intentionally omitted; decision count is a better readiness signal than speculative timelines.

---

## 3. Cross-Document Conflicts

**Severity definitions:**

- **Blocking** — must be decided before the affected module's schema or code is written.
- **High** — will cause rework if not decided before the affected phase.
- **Medium** — affects quality or consistency but can be decided during the phase.
- **Low** — documentation hygiene.

### 3.1 Blocking conflicts

#### C-01 — Workspace is both required and absent from the ownership model

**Sources:** DB §2 ERD (lines 48–70), DB §3.3–3.4, DB §7.1; TA §5.3, §6.4; TRD §4.

**Conflict:** DB §7.1 states "Every project must belong to a workspace", and `Project` has `workspaceId`. But the ERD models `USER ||--o{ PROJECT : owns` and never connects `WORKSPACE` to `PROJECT`. TA §6.4 shows the correct hierarchy (`User → Workspace → Project`). TRD routes place projects at `/dashboard/projects/...` with no workspace segment, while TA §5.3 requires every query to enforce workspace ownership.

**Impact:** Every repository, authorization check, index, and future team feature depends on the tenancy root. Two developers could reasonably implement two different ownership models. The ERD is the most likely artefact to be copied into Prisma, so this is a high-probability defect.

**Proposed resolution (pending approval):** Make `Workspace` the sole tenancy root. `Project` belongs to exactly one workspace; `ownerId` is retained as the creating user, not as an access boundary. Auto-provision one personal workspace per user on first authenticated access. For MVP, keep the workspace implicit in URLs; add workspace-scoped routes only when teams ship. Correct the ERD before schema work.

**Gate:** Prisma schema, auth provisioning, all repository queries.

---

#### C-02 — Finding status vocabulary differs between PRD and schema

**Sources:** PRD §4.6 (lines 232–240); DB §3.10 (lines 367–376); TA §11.1 (lines 1007–1028); DESIGN §4 (lines 121–130).

**Conflict:** The PRD lists finding statuses as `Idea`, `Observed`, `Needs Validation`, `Confirmed`, `Rejected`, `False Positive`, `Reportable`. The database and architecture use `DRAFT`, `NEEDS_VALIDATION`, `UNDER_REVIEW`, `CONFIRMED`, `FALSE_POSITIVE`, `REJECTED`, `REPORTABLE`, `CLOSED`. `IDEA` and `OBSERVED` are hypothesis statuses (FLOW §10, DB §3.9), not finding statuses. The PRD omits `UNDER_REVIEW` and `CLOSED`.

**Impact:** The finding lifecycle is the core of the product. Mismatched enums break status transition tests, verification mapping, dashboard counts, and UI labels.

**Proposed resolution (pending approval):** Adopt the DB/TA lifecycle as canonical (`DRAFT → NEEDS_VALIDATION → UNDER_REVIEW → {CONFIRMED | REJECTED | FALSE_POSITIVE} → REPORTABLE → CLOSED`). Keep `IDEA`/`OBSERVED` exclusively for hypotheses. Update the PRD wording only after product sign-off.

**Gate:** Prisma schema, finding services, verification, dashboard.

---

#### C-03 — Four incompatible AI task state machines

**Sources:** TRD §10 (lines 480–486); DB §4.4 (lines 543–550); TA §8.4 (lines 729–759); AIA §7 (lines 461–505).

**Conflict:**

| Document | States |
|---|---|
| TRD | `PENDING`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED` |
| DB | `PENDING`, `RUNNING`, `AWAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED` |
| TA | `CREATED`, `VALIDATING`, `AUTHORIZED`, `CONTEXT_ASSEMBLY`, `PROCESSING`, `OUTPUT_VALIDATION`, `AWAITING_REVIEW`, `COMPLETED`, plus `FAILED`, `CANCELLED`, `REJECTED`, `NEEDS_REVIEW` |
| AIA | `CREATED`, `PERMISSION_CHECK`, `CONTEXT_ASSEMBLY`, `TASK_ASSIGNMENT`, `AI_PROCESSING`, `OUTPUT_VALIDATION`, `RESULT_STORAGE`, `HUMAN_REVIEW`, `COMPLETED`, plus `REJECTED`, `FAILED`, `CANCELLED`, `TIMED_OUT` |

TA and AIA additionally define `AITaskEvent` event types, which overlap with their own lifecycle states.

**Impact:** The task table, API, polling, retry logic, and UI badges all depend on one state machine. Four documents cannot all be implemented.

**Proposed resolution (pending approval):** Persist the DB status set as the single state field, add `TIMED_OUT`, and express the lifecycle stages (`PERMISSION_CHECK`, `CONTEXT_ASSEMBLY`, `OUTPUT_VALIDATION`, `HUMAN_REVIEW`) as `AITaskEvent` records. This preserves the audit trail without multiplying statuses. Treat `AWAITING_APPROVAL` as the canonical human-gate state.

**Gate:** Prisma AI models, task service, AI workspace UI.

---

#### C-04 — AI and human verification conclusions are conflated

**Sources:** PRD §4.8 (line 281); TRD §6 (lines 343–354); DB §4.6 (lines 577–608); FLOW §12 (lines 328–335); AIA §4.3 (lines 276–283).

**Conflict:** `VerificationReview` stores both `AI` and `HUMAN` reviewers in one table with one `conclusion` enum: `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, `CONFIRMED`. AIA explicitly says the AI's strongest output is `REVIEW_SUPPORTS_CONFIRMATION`, not `CONFIRMED`, because "the last result is an AI recommendation, not final human confirmation." The PRD says AI cannot independently promote a finding to `Confirmed` or `Reportable`.

**Impact:** A single enum allows an AI-authored row to carry `CONFIRMED`, which contradicts the product's central safety promise. Even if application code prevents it, the schema encodes the wrong rule.

**Proposed resolution (pending approval):** Split the conclusion vocabulary by reviewer type. AI conclusions: `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, `REVIEW_SUPPORTS_CONFIRMATION`. Human conclusions: `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, `CONFIRMED`, `REJECTED`. Enforce the distinction with application guards and, where practical, a database check constraint.

**Gate:** Verification schema, finding transition service, report eligibility.

---

#### C-05 — Evidence has two incompatible models, two owners, and two upload contracts

**Sources:** DB §3.11–3.12 (lines 389–446); DB §7.5; TA §10.3–10.5 (lines 940–1000); TRD §7 (lines 395–398); FLOW §11 (lines 308).

**Conflict:**

- DB `Evidence` belongs to an `Investigation` only (`investigationId` required), with no `workspaceId`, `projectId`, or `findingId`. Findings are connected through `EvidenceLink`.
- TA §10.3 lists `workspaceId`, `projectId`, `investigationId`, **and** `findingId` directly on the evidence record, plus `fileName`/`fileType` instead of `title`/`evidenceType`/`mimeType`.
- TRD exposes `POST /api/evidence` (direct upload). TA exposes `POST /api/evidence/upload-url` (presigned flow), and TA §10.4 describes a temporary-upload-permission flow.
- FLOW §11 says evidence is immutable once submitted and corrections create a new version, but the DB has no version or `supersedesId`, and the API permits `DELETE /api/evidence/[id]`.

**Impact:** Evidence is the product's core differentiator. Ownership, immutability, and upload security cannot be retrofitted cleanly after storage keys and links exist.

**Proposed resolution (pending approval):** Evidence belongs to the investigation, inherits workspace/project through it, and is linked to findings only through `EvidenceLink`. Add a denormalized `workspaceId` for query isolation if performance requires it, maintained by the service layer. Use the presigned upload flow. Add `version`, `supersedesId`, and `deletedAt` (soft delete) rather than hard delete. Remove the direct `findingId` field from the TA metadata list.

**Gate:** Evidence schema, storage adapter, upload UI, finding links.

---

#### C-06 — Target authorization has two sources of truth and no verification model

**Sources:** PRD §4.3 (lines 180–185); DB §3.5–3.6 (lines 175–247); TA §9.1–9.3 (lines 865–907); FLOW §6–7 (lines 166–205); TRD §5.3 (lines 236–249).

**Conflict:** `Target.authorizationStatus` and `Target.authorizationExpiresAt` duplicate `ScopeVersion.status` and `ScopeVersion.effectiveUntil`. TA §9.3 requires the server to check both "the target is authorized" and "the relevant scope version is current", but no document states which wins when they disagree, or how a target becomes `AUTHORIZED` in the first place. `UNVERIFIED` is defined, but no verification process is defined. The app "validates required fields" (FLOW §6) — field presence is not authorization.

**Impact:** Scope enforcement is the product's safety backbone. Without a single authority and a defined attestation model, "authorized" is a label the user can set, not a server-enforced condition.

**Proposed resolution (pending approval):** Make the active `ScopeVersion` the sole authority for permitted activity. Treat `Target.authorizationStatus` as a derived summary, recomputed from scope state, never independently edited. Define MVP authorization as **user attestation with a required source and expiration date**, recorded in the audit log and displayed as "self-attested"; external verification is a later capability. Define `REVOKED` and `EXPIRED` as computed or event-driven states. Product sign-off is required because this defines what "authorization" means in the MVP.

**Gate:** Target/scope schema, scope validator, investigation creation, any future testing integration.

---

#### C-07 — AI credential ownership is undecided (per-user BYOK vs platform key)

**Sources:** FLOW §3 Step 5 (lines 107–113); DB §4.1 (lines 452–470); TRD §6 (lines 63–76); TA §15 (lines 1236–1237); PRD §10 (line 465).

**Conflict:** The onboarding flow asks each user to configure Claude API access and "store provider credentials securely." The schema provides a per-user `AIProviderConfig` with `encryptedCredentialReference`. But the environment contract provides one server-side `ANTHROPIC_API_KEY`, and TA §21.1 forbids exposing private keys client-side. The PRD's cost risk mitigation assumes platform-controlled "usage limits and task budgets," which is difficult with user-owned keys.

**Impact:** This is not a detail. It determines onboarding, billing, secret storage, `AIProviderConfig` semantics, abuse controls, and whether the app can function without user setup. Choosing wrong creates a security or UX rewrite.

**Proposed resolution (pending approval):** For MVP, use a **platform-owned key** held server-side, with per-user and per-task token budgets, and remove the credential-entry step from onboarding. Retain `AIProviderConfig` for model preference and future BYOK, but do not require credentials. Revisit BYOK when billing and tenant isolation are designed.

**Gate:** Onboarding, AI module, secrets management, cost controls.

---

#### C-08 — Authentication provider is undecided

**Sources:** TRD §2 (line 58); TA §2.1, §5.1, §15, §23 (lines 69, 363–374, 1231–1252, 1644).

**Conflict:** TRD recommends Clerk. TA says "Auth.js or Clerk" and "choose one," while the environment example is Auth.js-shaped (`AUTH_SECRET`, `AUTH_URL`, `GOOGLE_CLIENT_ID`). Both are viable; the documents do not choose.

**Impact:** Blocks user synchronization, middleware, protected-route implementation, session shape, webhook design, and environment configuration. It is the first external dependency in Phase 2.

**Proposed resolution (pending approval):** Choose Clerk for MVP to match the TRD recommendation and reduce auth surface area, or Auth.js if self-hosting/portability is a hard requirement. Record the decision as an ADR and delete the losing option from the docs. Do not implement both.

**Gate:** Phase 2, user provisioning, workspace bootstrap.

---

#### C-09 — Delegated-mode capabilities and scope-gated actions are undefined

**Sources:** PRD §4.3, §5, §11.13; TRD §5.3–5.4; TA §8.7, §9.3; AIA §11; FLOW §9.

**Conflict:** Every document says delegated tasks must be blocked outside scope, and PRD acceptance criterion 13 says "Unauthorized actions are blocked by the application." But the MVP has no scanning, exploitation, browser automation, or shell execution. The only AI capabilities are analysis and summarization over supplied context. Therefore there is currently **no target-touching action to authorize or block**. `RECON_ANALYSIS` and `ATTACK_SURFACE_ANALYSIS` imply external retrieval that no document designs.

**Impact:** The central safety claim cannot be tested, and implementers may either build unnecessary enforcement machinery or skip it because nothing uses it. It also leaves "Delegated Mode" semantically unclear: it may be a structured-task UX rather than delegated execution.

**Proposed resolution (pending approval):** Define an explicit capability enum (for example `READ_PROJECT_CONTEXT`, `AI_ANALYZE_SUPPLIED_CONTENT`, `AI_ANALYZE_TARGET_CONTEXT`, `PASSIVE_FETCH`, `ACTIVE_TEST`, `EXPORT_REPORT`). For MVP, allow the first two and report export; mark the rest `NOT_IMPLEMENTED` and block them at the orchestrator. Define Delegated Mode as "structured analysis task with human approval," not autonomous testing. Then criterion 13 becomes testable: every blocked capability must be refused server-side.

**Gate:** Scope validator, AI orchestrator, acceptance testing.

---

#### C-10 — Scope authorization evidence has a circular dependency

**Sources:** DB §3.6 (line 232), §3.11 (line 394), §7.5; TA §9.2 (line 889).

**Conflict:** `ScopeVersion.authorizationEvidenceId` references an evidence record. But `Evidence.investigationId` is required, and scope authorization is established before an investigation exists. A target's authorization artifact therefore cannot be stored as evidence without violating the evidence ownership constraint.

**Impact:** Blocks the target/scope schema and the "authorization evidence" requirement in PRD §4.3.

**Proposed resolution (pending approval):** Either (a) add a dedicated `AuthorizationArtifact` model owned by the target/workspace, or (b) make `Evidence.investigationId` nullable and require `workspaceId` plus at least one owner reference (target, investigation, or report). Option (b) is simpler but weakens the "evidence belongs to an investigation" rule; option (a) preserves it. Recommend (a) for clarity, with a shared storage adapter.

**Gate:** Target/scope schema, evidence schema, storage service.

---

### 3.2 High-severity conflicts

#### C-11 — Report scope and model are ambiguous

**Sources:** PRD §4.9 (lines 283–298); DB §5 (lines 632–666); TA §6.4 (line 474); FLOW §13 (line 341).

**Conflict:** The ERD and `Report` model attach reports to an investigation. The report flow starts from a single confirmed finding. TA's relationship tree places `Report` under `Project`. No `ReportTemplate` model exists despite "report templates" being a PRD and TRD feature. `ReportRevision.content` has no field preserving the evidence references used at generation time, despite the requirement to do so.

**Impact:** Report generation, revision history, and evidence traceability all depend on the scope decision.

**Proposed resolution (pending approval):** Report belongs to an investigation; add a `ReportFinding` join table for included findings; add `ReportTemplate`; store an evidence-reference snapshot on each revision. This supports both "report from a finding" and "report the investigation."

**Gate:** Phase 6 schema and reporting service.

#### C-12 — Investigation creation may require an authorized target, or may not

**Sources:** TRD §5.4 (line 263: "must reference an authorized learning environment or target"); FLOW §8 (line 219: "checks project and target authorization records"); DB §3.5 (line 216: "An unverified target may be documented but cannot be used for active testing").

**Conflict:** If investigation creation requires `AUTHORIZED`, users cannot investigate a documented-but-unverified target, which contradicts the documentation-only use case. If it does not, the TRD requirement is unmet.

**Impact:** Blocks the primary user journey (project → target → investigation) and the meaning of target readiness.

**Proposed resolution (pending approval):** Allow investigations against `PENDING`/`UNVERIFIED` targets in analysis-only mode. Require an active scope only for capabilities that touch the target (see C-09). Record the target's authorization state on the investigation for display and audit.

**Gate:** Investigation service, target selector, scope guard.

#### C-13 — AI provider interface has three different contracts

**Sources:** TRD §6 (lines 317–324); TA §8.2 (lines 666–683); AIA §9 (lines 554–566).

**Conflict:** TRD specifies `generateResponse()`, `generateStructuredResponse()`, `estimateUsage()`, `getProviderStatus()`. TA specifies only `generateResponse()`. AIA specifies `generate()`, `generateStructured()`, `stream()`, `getUsage()`, `getStatus()`. Only AIA includes streaming; only TRD includes usage estimation.

**Impact:** The provider abstraction is a stated architectural priority. Three contracts will produce three partial implementations and provider-specific leakage.

**Proposed resolution (pending approval):** Adopt the AIA contract as canonical, adding `estimateUsage` if it can be implemented meaningfully. Declare streaming optional behind a capability flag. Record `provider`, `model`, and prompt version on every task.

**Gate:** AI module, Phase 4.

#### C-14 — API surface and mutation strategy drift

**Sources:** TRD §7 (lines 368–412); TA §7.1–7.2 (lines 489–571); TA §19.3.

**Conflict:** TRD defines a REST endpoint for nearly every operation, including direct evidence upload. TA says Server Actions are the preferred path for UI mutations, Route Handlers for asynchronous/external operations, and defines a different endpoint set (presigned upload, conversation messages, no `POST /api/ai/reviews`). Neither document states which path is canonical for a given mutation.

**Impact:** Duplicate mutation paths invite divergent authorization logic, the most dangerous class of bug in a multi-tenant app.

**Proposed resolution (pending approval):** Use Server Actions for first-party UI mutations. Use Route Handlers only for streaming, webhooks, long-running tasks, and a future public API. Define one canonical path per operation and document it in an API contract table. Do not implement both for the same action.

**Gate:** All modules; especially Phase 2–5.

#### C-15 — Evidence type taxonomy differs across three documents

**Sources:** PRD §4.7 (lines 246–253); DB §3.11 (lines 409–417); TA §10.2 (lines 929–938).

**Conflict:** PRD includes reproduction notes, reviewer comments, and external references. DB includes `SCREENSHOT`, `HTTP_REQUEST`, `HTTP_RESPONSE`, `TEXT_OBSERVATION`, `DOCUMENT`, `LOG`, `OTHER`. TA includes research references and controlled-environment test results. No list is a superset.

**Impact:** Upload UX, MIME validation, iconography, and AI context selection all depend on the enum.

**Proposed resolution (pending approval):** Add `EXTERNAL_REFERENCE` and `REPRODUCTION_NOTE` to the DB enum. Model reviewer comments as `VerificationReview` records, not evidence. Keep `OTHER` as a last resort.

**Gate:** Evidence schema and UI.

#### C-16 — Audit and membership are scheduled too late in the database plan

**Sources:** DB §10 (lines 748–783); TA §20 Phase 2 (lines 1509–1520); TRD §7 (line 412: "All endpoints require ... audit logging"); TA §14.4.

**Conflict:** DB places `AuditLog` and `WorkspaceMember` in Phase 4. TA's Phase 2 explicitly implements `WorkspaceMember`, and the security requirements demand audit logging from the beginning. Deferring audit until after AI and evidence means the highest-risk actions are unlogged during development.

**Impact:** Retrofitting audit into every service is expensive and error-prone; membership is needed for even a single-user workspace.

**Proposed resolution (pending approval):** Move `WorkspaceMember` to Phase 2 and `AuditLog` to Phase 2 (at least the table and the auth/permission events). Keep AI-specific audit events for Phase 4. Treat DB §10 as schema-creation convenience order, not security order.

**Gate:** Phase 2 schema and service conventions.

#### C-17 — Documentation naming and structure drift

**Sources:** PLAN §3 (line 141 references `docs/TRD.md`); TA §4 (lines 243–251); actual file names.

**Conflict:** The actual file is `TECHNICAL-REQUIREMENTS.md`, not `TRD.md`. PLAN's structure also omits `TECHNICAL-ARCHITECTURE.md`.

**Impact:** Low functional impact; causes broken references and confusion for new contributors.

**Proposed resolution (pending approval):** Standardise on the actual filenames and add the architecture document to the structure listing. Documentation-only change.

---

## 4. Missing Technical Decisions

The following choices are not made anywhere in the documentation, or are made ambiguously. Each is listed with a proposed default for discussion — **not** an applied change.

### 4.1 Product, safety, and cost

| ID | Decision needed | Why it matters | Proposed default (pending approval) | Blocks |
|---|---|---|---|---|
| M-01 | How does a target become `AUTHORIZED`? Self-attestation, evidence review, or external verification? | Defines the meaning of the safety backbone | Self-attestation with source, evidence, expiry, and audit record; display as "self-attested" | Scope schema, UI |
| M-02 | What exactly does scope gate in the MVP? | Makes acceptance criterion 13 testable | Capability enum; only analysis and export enabled in MVP | Orchestrator, tests |
| M-03 | Who owns AI credentials and cost? | Changes onboarding, security, billing | Platform key + per-user budgets | AI config, onboarding |
| M-04 | When is redaction applied — before storage, before AI processing, or both? | PRD says before storage/AI; schema models post-upload status | Automated detection advisory + human `VERIFIED_SAFE`; never send raw file bodies to AI | Evidence, context manager |
| M-05 | Concrete retention periods and account-deletion behaviour | Required by DB §9 but unspecified | Audit 24 months; AI conversations 12 months configurable; evidence until project deletion + 30 days; legal review required | Schema, storage lifecycle |
| M-06 | Duplicate-detection technique and storage | PRD feature; no schema field | Normalized title/category + `pg_trgm` similarity for MVP; embeddings later; add `duplicateOfId` | Finding schema |
| M-07 | Severity method and affected-asset capture | PRD requires both; schema lacks affected asset and scoring method | Manual severity enum + rationale; add `affectedAsset`; CVSS later | Finding schema/UI |
| M-08 | Is multi-provider support in MVP or later? | PRD lists it as a secondary objective; AIA treats it as future | Abstraction now, Anthropic only in MVP | AI config |

### 4.2 Data model

| ID | Decision needed | Why it matters | Proposed default (pending approval) | Blocks |
|---|---|---|---|---|
| M-09 | Are hypothesis↔observation links and scope asset lists relational or JSON? | Determines queryability, integrity, and migration cost | Relational join tables (`HypothesisObservation`, `ScopeAsset` with allowed/excluded flag) | Prisma schema |
| M-10 | Where are human approvals and allowed status transitions recorded? | PRD requires human authority; schema has both `Finding.approvedBy` and `VerificationReview` | One transition table or a documented transition matrix; approval recorded as a human `VerificationReview`; `approvedBy` is a denormalized pointer | Finding/verification |
| M-11 | How is evidence immutability enforced with corrections? | FLOW requires versioning; schema has no version field | Add `version`, `supersedesId`, `deletedAt` | Evidence schema |
| M-12 | Which traceability fields belong on `AITask`? | AIA success criterion 10 requires prompt/model traceability | Add `provider`, `model`, `promptVersion`, `contextVersion`, `idempotencyKey` | AI schema |
| M-13 | Is a session summary AI-generated, human-written, or both? | Memorable context is a core differentiator; provenance matters | Add `generatedByType` (`AI`/`HUMAN`), `model`, `promptVersion`, `sourceTaskId`; allow both | Session summary schema |
| M-14 | Is there a human-readable investigation ID? | PRD/FLOW say "assign investigation ID"; DB uses UUID | Add `displayId` (for example `INV-2026-0001`) generated transactionally per workspace | Investigation schema/UI |
| M-15 | Report scope, templates, and revision snapshots | See C-11 | Investigation-owned report + `ReportFinding` + `ReportTemplate` + evidence snapshot | Reporting |
| M-16 | Missing fields on existing models | Several required features have no storage | `Target.programUrl`, `Target.authorizationDate`, `Finding.affectedAsset`, `ScopeVersion.approvedBy/approvedAt` | Schema |
| M-17 | Evidence ownership when it supports a target, not an investigation | See C-10 | Dedicated `AuthorizationArtifact` or nullable investigation reference | Evidence/target |
| M-18 | Should workspace-scoped URLs be introduced now? | PRD says teams later; route migration is costly | Keep implicit personal workspace for MVP; reserve `/w/[workspaceSlug]` | Routing |

### 4.3 AI

| ID | Decision needed | Why it matters | Proposed default (pending approval) | Blocks |
|---|---|---|---|---|
| M-19 | How is structured output enforced? | Zod validation alone does not force valid JSON | Anthropic tool use with JSON schema, then Zod re-validation; one corrective retry; fail closed | AI module |
| M-20 | Default model per task and token budgets | No model names or numeric budgets exist | Sonnet-class for research/verification, Haiku-class for summaries; per-task input/output caps and daily user cap | AI module |
| M-21 | Where are prompts stored and versioned? | Reproducibility requirement | Versioned files in the repo, content hash recorded on each task; DB overrides later | AI module |
| M-22 | Delegated-mode capability matrix | See C-09 | Explicit task → inputs → side effects → approval table | Orchestrator |
| M-23 | Prompt-injection defence design | Repeatedly required, never specified | Delimit untrusted content, no tools in MVP, instruction hierarchy, output schema validation, injection test corpus | AI module |
| M-24 | Streaming and serverless timeout strategy | Determines route vs background task design | Stream chat via Route Handler; non-streaming long tasks go to background with polling | AI/API |
| M-25 | AI evaluation dataset and CI gate | Required before assistant release | JSONL fixtures + mock-provider tests in CI; live evaluation manual | QA |
| M-26 | Context compression trigger | "Summarise long conversations" is unspecified | Summarise at 60% of model context; keep summary + last N turns | AI context |
| M-27 | Multi-provider configuration surface | PRD secondary objective; model fields present | Hide provider switching in MVP; keep interface | AI config |

### 4.4 Platform, operations, and testing

| ID | Decision needed | Why it matters | Proposed default (pending approval) | Blocks |
|---|---|---|---|---|
| M-28 | Hosting, PostgreSQL provider, and Prisma pooling | DB doc names Neon; TA says "managed PostgreSQL"; serverless needs pooling | Vercel + Neon with pooled `DATABASE_URL` and `DIRECT_URL` for migrations | Phase 1/2 |
| M-29 | Object storage provider and upload constraints | TA says S3-compatible; no provider or limits | S3-compatible private bucket, presigned PUT/GET, 5-minute TTL, 25 MB limit, MIME sniffing | Evidence |
| M-30 | Malware scanning for uploads | Security product accepting untrusted files | Explicitly defer with documented risk, or integrate a scanner before public launch | Evidence |
| M-31 | Rate-limit storage | Serverless instances cannot share in-memory counters; TA discourages Redis early | Upstash Redis or Vercel KV; apply to auth, AI, and upload endpoints | Security |
| M-32 | Background job approach and idempotency | TRD says job system; TA says DB-backed first | DB task record + synchronous short tasks; add Inngest/Trigger.dev when tasks exceed request limits; require idempotency key | AI/reliability |
| M-33 | CI pipeline, test database, and AI mock provider | No CI is defined; AI tests need determinism | GitHub Actions, Postgres service container or Neon branch, `MockAIProvider` | Phase 1 |
| M-34 | Observability tooling | "Error monitoring" required, no tool named | Sentry + structured logs (pino); Vercel analytics | Deployment |
| M-35 | Secrets encryption for future BYOK | Schema says encrypted credential reference, no mechanism | Platform key via hosting secrets; BYOK later with AES-256-GCM and KMS-managed key | AI config |
| M-36 | Node, Yarn, Next.js, Tailwind versions | "Yarn" is specified but not the major version; Tailwind/shadcn compatibility matters | Pin Node LTS, Yarn 4, current stable Next.js/Tailwind; record in `.tool-versions`/`packageManager` | Phase 1 |
| M-37 | PDF export implementation | Required in PRD; no approach | HTML template rendered to PDF via Playwright worker, or `@react-pdf/renderer`; decide in Phase 6 | Reporting |
| M-38 | Environment/region and data residency | Research data may be sensitive | Choose region with counsel; document retention and residency | Deployment |
| M-39 | Email provider purpose | Listed in TA external services, no feature requires it | Remove until a notification feature exists | Architecture |

### 4.5 UX and onboarding

| ID | Decision needed | Why it matters | Proposed default (pending approval) | Blocks |
|---|---|---|---|---|
| M-40 | Onboarding route, completion flag, and workspace provisioning trigger | FLOW redirects to onboarding; no route or field exists | `/onboarding` protected route, `User.onboardingCompletedAt`, auto-create workspace on first login | Phase 1/2 |
| M-41 | How `experienceLevel` changes behaviour | Onboarding asks for it; no effect is specified | Map to explanation depth and prompt tone only; never permissions | AI/prompts |
| M-42 | Light theme and responsive breakpoints | Design brief is dark-first; accessibility target | Dark-first, tokens structured for a later light theme; define breakpoints | Design system |
| M-43 | AI vs human visual distinction contract | Design brief requires it; no component spec | `sourceType` on all derived records + shared badge/panel pattern | UI components |

---

## 5. Does the Architecture Support the PRD?

**Overall: yes in direction, partially in detail.** The modular monolith, relational model, orchestrator, and evidence/verification concepts are the right shape for the PRD. The gaps are concentrated in execution semantics rather than capability.

### 5.1 PRD module traceability

| PRD module | Architectural support | Verdict | Gap |
|---|---|---|---|
| 4.1 Research Dashboard | Routes, shell, metrics implied | Partial | No activity-feed source, no metric definitions, no pagination contract |
| 4.2 Project Management | Project model, CRUD endpoints, phases | Supported | Workspace ownership must be fixed (C-01) |
| 4.3 Target and Scope | Target, ScopeVersion, validator | Partial | Authorization authority (C-06), evidence circularity (C-10), no attestation model |
| 4.4 AI Research Workspace | Orchestrator, context manager, conversations | Partial | Four task machines (C-03), interface drift (C-13), no budget/streaming decision |
| 4.5 Investigation Management | Investigation, observations, hypotheses, summaries | Supported with gaps | Missing join models, display ID, "completed work" representation |
| 4.6 Finding Management | Finding model, statuses, duplicate detection | Partial | Status conflict (C-02), no affected asset, duplicate technique undefined |
| 4.7 Evidence Management | Evidence, storage, links | Partial | Model conflict (C-05), immutability missing, redaction pipeline undefined |
| 4.8 Verification Engine | VerificationReview, assistants, human approval | Partial | AI/human enum conflation (C-04), no transition guard |
| 4.9 Report Builder | Report, revisions, flow | Partial | Scope/template/snapshot gaps (C-11), PDF approach undefined |
| 4.10 Learning Centre | Explicitly later release | Consistent | Not in MVP; no architecture needed yet |
| 5 Operating Modes | Guided and delegated flows | Partial | Delegated capability model undefined (C-09) |
| 6 User Roles | WorkspaceMember, future roles | Consistent | Roles premature for MVP; defer enforcement |
| 9 Non-functional | Security/testing/deployment sections | Partial | Rate limiting, background jobs, observability, retention undefined |

### 5.2 PRD MVP acceptance criteria

| # | Criterion | Supported? | Note |
|---|---|---|---|
| 1 | Register and authenticate | Yes, provider TBD | C-08 |
| 2 | Create and manage projects | Yes | After C-01 |
| 3 | Register authorized environments | Partial | No authorization verification model |
| 4 | Document scope restrictions | Partial | Two sources of truth |
| 5 | Create investigations | Partial | Target-authorization requirement ambiguous (C-12) |
| 6 | AI reads relevant context | Yes | Budgets and context version missing |
| 7 | Record hypotheses and observations | Yes | Join models missing |
| 8 | Attach evidence to findings | Partial | Evidence model conflict |
| 9 | AI performs structured reviews | Yes | Conclusion enum conflict |
| 10 | Human approval for final classification | Partial | Transition guards/approval records undefined |
| 11 | Investigation history persists | Yes | SessionSummary provenance missing |
| 12 | Generate reports from findings | Partial | Report scope/model gaps |
| 13 | Unauthorized actions blocked | **Not testable** | No target-touching MVP action defined (C-09) |

### 5.3 Architectural rules vs PRD

The 15 "must not be violated" rules in TA §21 are consistent with the PRD and should be treated as non-negotiable. Two require schema-level support that is currently missing:

- Rule 5 (AI cannot auto-confirm) — undermined by C-04.
- Rule 4 (no target testing without validated authorization) — undermined by C-06 and C-09.

---

## 6. Readiness Scorecard

| Area | Status | Rationale | Exit gate |
|---|---|---|---|
| Product intent | Green | Clear problem, users, principles, and MVP boundary | None |
| Product specification precision | Amber | Status vocabulary and acceptance criterion 13 need decisions | C-02, C-09 |
| Domain model | Red | Tenancy, evidence, authorization, status enums unresolved | C-01, C-05, C-06 |
| Database schema | Red | Missing join models, traceability fields, immutability, circular reference | M-09–M-18 |
| Authentication and authorization | Red | Provider undecided; workspace bootstrap undefined | C-08, M-40 |
| Scope and safety | Amber–Red | Strong intent; no enforceable capability model | C-06, C-09 |
| AI architecture | Amber | Strong principles; competing state machines and interface contracts | C-03, C-04, C-13 |
| Evidence management | Red | Two models, two upload flows, no versioning | C-05, M-04, M-11 |
| Verification | Amber | Correct concept; AI/human conclusions conflated | C-04, M-10 |
| Reporting | Amber | Flow clear; model and templates incomplete | C-11, M-15 |
| Platform and operations | Amber–Red | Hosting, storage, rate limiting, jobs, CI undecided | M-28–M-36 |
| Testing | Amber | Strategy defined; harness and AI mock undefined | M-25, M-33 |
| UX and design | Green–Amber | Distinctive and specific; needs component contracts and onboarding route | M-40–M-43 |
| Implementation sequencing | Green–Amber | Phases broadly aligned; database priority contradicts security order | C-16 |

**Interpretation:** Red does not mean the design is wrong. It means an implementer cannot proceed without guessing, and guessing here creates expensive rework.

---

## 7. Risks If Implementation Starts Now

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two developers implement different ownership models | High | Critical | Resolve C-01 before any repository code |
| AI verification schema allows AI to set `CONFIRMED` | High | Critical (product promise) | Resolve C-04 before verification schema |
| Evidence storage keys and links built on the wrong ownership model | High | High rework | Resolve C-05 before storage adapter |
| Scope enforcement becomes decorative | High | Critical | Define capabilities (C-09) and single authority (C-06) |
| Onboarding built around BYOK then changed to platform key | Medium | High rework | Resolve C-07 before onboarding |
| Auth provider chosen implicitly by copying one env example | Medium | High rework | Decide C-08 explicitly |
| AI task UI built against four status sets | High | Medium rework | Resolve C-03 before AI UI |
| Audit logging retrofitted after evidence/AI | Medium | High compliance cost | Implement audit from Phase 2 (C-16) |
| Report model rebuilt after first export | Medium | Medium rework | Resolve C-11 before Phase 6 |
| Acceptance criterion 13 cannot be demonstrated | High | Blocks release | Define capability enforcement (C-09) |

---

## 8. Go / No-Go Conditions

### Must be true before Phase 2 (auth + schema)

- C-01 ownership model decided and ERD corrected.
- C-08 authentication provider decided.
- M-40 workspace provisioning and onboarding trigger defined.
- C-16 audit/membership order corrected.

### Must be true before Phase 3 (projects, targets, scope)

- C-06 authorization authority and attestation model decided.
- C-10 scope evidence model decided.
- C-12 investigation target requirement decided.
- M-09 join-model strategy decided.
- M-16 missing target/scope/finding fields decided.

### Must be true before Phase 4 (AI)

- C-03 task state machine decided.
- C-04 verification conclusion split decided.
- C-07 credential/cost model decided.
- C-13 provider interface decided.
- M-19–M-26 decided.
- C-09 capability matrix decided.

### Must be true before Phase 5 (evidence + findings)

- C-05 evidence model and upload flow decided.
- M-04 redaction pipeline decided.
- M-06 duplicate detection decided.
- M-10 transition/approval matrix decided.
- M-11 evidence versioning decided.

### Can be deferred

- Multi-provider switching, learning centre, team roles, marketplace, billing, embeddings-based duplicate detection, external authorization verification, PDF fidelity beyond a basic template.

---

## 9. Recommended First Implementation Task

### Prerequisite: Decision lock (not a coding task)

Hold a short decision session covering the 10 blocking conflicts and M-01, M-02, M-09, M-10, M-19, M-20, M-28, M-31, M-33, M-40. Record outcomes in a new `docs/DECISIONS.md` (ADR log). Do not edit the PRD or architecture silently; either record the decision as an addendum or update the source document explicitly with a version bump.

### Recommended task: **Foundation and Domain Contract Slice**

**Why this first:** It is the largest amount of work that does not depend on the unresolved product decisions. It establishes the build, quality gates, design tokens, and executable domain contracts, so later modules cannot drift. It also converts the most dangerous enum conflicts into failing tests before they become schema.

**Scope**

1. **Repository scaffold**
   - Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Lucide.
   - Inter and JetBrains Mono via `next/font`.
   - Design tokens from DESIGN §4, dark-first.
   - Pin the toolchain (Node LTS, Yarn major version, package manager field).

2. **Quality gates**
   - ESLint and Prettier.
   - Vitest and Playwright configuration.
   - Zod available for shared schemas.
   - `src/config/env.ts` with fail-fast server/client environment validation.
   - GitHub Actions: install, lint, typecheck, unit tests, build.
   - Playwright smoke test for the shell.

3. **Application shell**
   - Sidebar, header, breadcrumbs, responsive navigation, user-menu placeholder.
   - Empty dashboard placeholder with no fabricated metrics.
   - Loading, empty, and error primitives.
   - No domain feature screens.

4. **Canonical domain contracts (pure TypeScript + Zod, no database)**
   - Finding status enum and allowed-transition guard.
   - Hypothesis status enum and guard.
   - AI task status enum (`PENDING`, `RUNNING`, `AWAITING_APPROVAL`, `COMPLETED`, `FAILED`, `CANCELLED`, `TIMED_OUT`) and event types.
   - Verification conclusion enums split by reviewer type.
   - Capability enum from C-09, with MVP blocked/allowed sets.
   - Ownership rule helper: every resource resolves to a workspace.
   - Unit tests for every valid and invalid transition.

5. **Documentation**
   - `docs/DECISIONS.md` with ADR-001 to ADR-010.
   - `docs/ENGINEERING.md` with commands, conventions, and the "one mutation path per operation" rule.
   - `.env.example` aligned with the chosen auth provider.
   - `README.md` with local setup.

**Explicitly out of scope**

- Prisma schema, migrations, or database connection beyond an optional health check.
- Authentication integration or user tables.
- AI provider calls, prompts, or task execution.
- Evidence upload or storage.
- Any feature screen beyond the shell.

**Acceptance criteria**

- `yarn install`, `yarn lint`, `yarn typecheck`, `yarn test`, and `yarn build` succeed locally.
- CI runs the same checks on every pull request and passes.
- The app renders a responsive shell at desktop and mobile widths.
- Environment validation fails fast with a clear message when a required variable is missing.
- Every status transition has a positive and negative unit test.
- No secrets are committed; `.env.local` is ignored.
- The eight source documents are unchanged.

**Estimated shape:** one vertical slice, reviewable in a single pull request, with no external service dependency.

### Recommended next five tasks

1. **Prisma foundation + auth + workspace bootstrap** — User, Workspace, WorkspaceMember, Project; personal workspace provisioning; server-side access guard; audit table.
2. **Project and target management** — CRUD, target registration, authorization attestation, scope versioning, scope validator with tests.
3. **Investigation management** — investigation, observations, hypotheses, join models, display ID, session summaries.
4. **Evidence and findings** — presigned storage, metadata, versioning, links, redaction status, finding transitions.
5. **AI orchestration (analysis-only)** — provider interface, mock provider, context assembly, structured output, task events, budgets; verification and reporting after evidence exists.

---

## 10. Proposed Decision Register

Use this as the agenda for the decision session. Each item needs a named owner and a recorded outcome.

| ID | Decision | Owner | Needed before |
|---|---|---|---|
| D-01 | Workspace is the sole tenancy root; personal workspace auto-provisioned (C-01) | Engineering | Phase 2 |
| D-02 | Canonical finding statuses; `IDEA`/`OBSERVED` are hypothesis-only (C-02) | Product + Engineering | Phase 2 |
| D-03 | Canonical AI task status set + event-based lifecycle (C-03) | Engineering | Phase 4 |
| D-04 | Split AI vs human verification conclusions (C-04) | Product + Engineering | Phase 4 |
| D-05 | Evidence belongs to investigation; links via `EvidenceLink`; presigned upload; versioned (C-05) | Engineering | Phase 5 |
| D-06 | Active scope version is the sole authorization authority; MVP is self-attestation (C-06/M-01) | Product + Security | Phase 3 |
| D-07 | Platform-owned AI key for MVP; BYOK later (C-07) | Product + Finance | Phase 4 |
| D-08 | Authentication provider (C-08) | Engineering | Phase 2 |
| D-09 | Capability enum and blocked/allowed MVP actions (C-09) | Product + Security | Phase 3 |
| D-10 | Scope authorization artefact model (C-10) | Engineering | Phase 3 |
| D-11 | Report ownership, templates, revision evidence snapshot (C-11) | Product + Engineering | Phase 6 |
| D-12 | Investigations allowed on documented targets; scope gates capabilities (C-12) | Product | Phase 3 |
| D-13 | Provider interface contract (C-13) | Engineering | Phase 4 |
| D-14 | Server Actions canonical for UI mutations; Route Handlers for async (C-14) | Engineering | Phase 2 |
| D-15 | Evidence type enum additions (C-15) | Product + Engineering | Phase 5 |
| D-16 | Audit and membership in Phase 2 (C-16) | Engineering | Phase 2 |
| D-17 | Relational join models for observations and scope assets (M-09) | Engineering | Phase 3 |
| D-18 | Transition matrix and human approval record (M-10) | Product + Engineering | Phase 2 |
| D-19 | Structured output via tool use + Zod re-validation (M-19) | Engineering | Phase 4 |
| D-20 | Model defaults and token budgets (M-20) | Product + Engineering | Phase 4 |
| D-21 | Hosting, Neon, and Prisma pooling (M-28) | Engineering | Phase 1 |
| D-22 | Rate-limit store (M-31) | Engineering | Phase 2 |
| D-23 | CI, test database, and AI mock (M-33) | Engineering | Phase 1 |
| D-24 | Onboarding route, completion flag, workspace provisioning (M-40) | Product + Engineering | Phase 1 |

---

## Appendix A — Evidence Index

Primary locations for the findings above:

- Finding statuses: PRD §4.6; DB §3.10; TA §11.1; DESIGN §4.
- Hypothesis statuses: FLOW §10; DB §3.9.
- AI task states: TRD §10; DB §4.4; TA §8.4; AIA §7.
- Verification conclusions: PRD §4.8; TRD §6; DB §4.6; FLOW §12; AIA §4.3.
- Workspace ownership: DB §2, §7.1; TA §5.3, §6.4; TRD §4.
- Evidence model: DB §3.11–3.12, §7.5; TA §10.3–10.5; TRD §7; FLOW §11.
- Authorization: PRD §4.3; DB §3.5–3.6; TA §9; FLOW §6–7; TRD §5.3.
- AI credentials: FLOW §3; DB §4.1; TRD §6; TA §15.
- Auth provider: TRD §2; TA §2.1, §5.1, §15, §23.
- Reports: PRD §4.9; DB §5; TA §6.4; FLOW §13.
- Implementation order: DB §10; TA §20; PLAN §4–13; AIA §14.
- Design system: DESIGN §4–11; TA §12.

## Appendix B — Change Log

| Date | Change |
|---|---|
| 2026-11-03 | Initial readiness review created. No source document modified. |

---

**End of report.**
