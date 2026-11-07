# Sentinel Research V2 migration plan

Status: historical audit migration plan. The user subsequently authorized implementation with “build v2”; see [implementation status](V2_IMPLEMENTATION_STATUS.md) and [operations](V2_OPERATIONS.md). This plan itself does not authorize production deployment. Audit date: 2026-11-07. Inputs: [V2 architecture](../technical-architecture-2.md), [V1 audit](V1_ARCHITECTURE_AUDIT.md), and [gap analysis](V2_GAP_ANALYSIS.md).

## 1. Migration objective and invariants

Extend the existing modular monolith through additive changes and bounded refactoring. Preserve manual research, existing guided conversations and bounded AI tasks, human verification, private evidence, reports and working URLs throughout the migration.

The following rules apply to every implementation milestone:

1. Keep all 28 current models, UUIDs, workspace ownership, author identities and relationships. Do not delete old tables, rewrite applied migrations, reset databases, or regenerate history from AI.
2. Keep PostgreSQL/Prisma authoritative. A background runner shares the application code and database; introduce no microservices, separate graph database or separate vector database.
3. Preserve server-side authentication, operation permissions and action-time scope enforcement. Client state, materialized authorization status, a retrieved document or an AI recommendation never grants authorization.
4. Preserve existing ScopeVersion IDs and approved rules. Revocation and supersession remain audited lifecycle operations. Add engagement association without creating a second authority for target scope.
5. Keep imported/AI recommendations distinct from human confirmation, severity, reportability and closure decisions.
6. Keep original evidence objects, checksums, report revision content and provenance. Revisions and source evidence referenced by historical reports must remain inspectable under the approved retention policy.
7. Keep existing non-AI workflows useful when Claude is unavailable. Do not return synthetic mock output as if it were live production reasoning.
8. New background work uses stable operation identities, durable state, bounded retries and safe cancellation. Exactly-once external model execution is not promised.
9. Do not implement autonomous security testing, unrestricted execution or automatic external submission. Imports and retest-result documentation analyze researcher-supplied material.

## 2. Recommended first implementation milestone

**Milestone M1: Research Data Foundation with protected V1 invariants.** This follows V2 Phase 1 while bringing necessary preservation/authorization checks forward. It is a reviewable first increment, not an implementation of the entire architecture.

Deliver:

- A minimal engagement domain and associations to existing projects, targets, investigations and scope versions.
- ResearchDecision and InvestigationRelation with trusted workspace/actor checks and explicit rationale/source associations.
- KnowledgeDocument, KnowledgeSource and KnowledgeRelation foundations; no embeddings or autonomous source fetching yet.
- Backward-compatible read contracts for records without new associations, and an idempotent legacy backfill with reconciliation reports.
- A single evidence-link mutation authority used by both existing UI paths; transaction guards preventing loss of approved evidence basis without a recorded review decision.
- Expected-state mutation checks for consequential finding/report operations and explicit evidence finalization prerequisites.
- An expand/backfill rehearsal against a restored V1 database and object inventory, plus preservation tests for V1 URLs, conversations, summaries, findings and reports.

Do not add a new agent framework, tool importer or semantic retrieval to this milestone. Current AI requests continue using the existing task service and provider. Keep newly stricter permissions scoped to agreed operation policy rather than silently blocking ordinary legacy documentation.

M1 is complete when old and new records coexist, the migration can be resumed safely, preserved V1 workflows still work, new engagement/decision relationships cannot cross workspaces, and legacy data does not gain approval or lose history during backfill. Review the exact schema and compatibility choices before applying a production migration.

## 3. Resolve contracts before expanding the schema

Record these decisions in new ADRs, retaining existing ADRs as historical decisions:

| Decision | Recommended initial position | Reason |
| --- | --- | --- |
| Engagement/project cardinality | Start with one legacy engagement per project and allow only relationships whose project/target ownership is explicit. Finalize whether new engagements can span projects before schema implementation. | Project is a partial engagement equivalent, but V2 does not define cardinality. Avoid guessing a general many-to-many assessment model. |
| Scope authority | EngagementAuthorization associates to an existing ScopeVersion and documented authorization source; ScopeVersion remains authoritative. | Current uniqueness permits only one ACTIVE scope per Target. Do not relax it to support competing engagement scopes without an explicit replacement design. |
| Legacy authorization | Preserve historical attestation and scope associations, and evaluate present validity from their actual dates/status. Missing engagement documentation stays incomplete. | Neither project type nor Target.AUTHORIZED projection is sufficient evidence of current authorization. |
| Investigation phase | Add analytical phase separately from existing status; derive a display hint only where defensible. | COMPLETED does not mean a vulnerability was confirmed, and ARCHIVED must retain history. |
| Run identity | AITask remains the existing AI request identity. Add/associate run, step, snapshot and execution records around it. | Avoid conflicting AITask/AgentRun state machines. |
| Review identity | Extend VerificationReview or wrap it with a FindingReview contract; retain old IDs and human conclusions. | A separate disconnected review table would duplicate the decision authority. |
| Finding lifecycle | Preserve old statuses. Model external outcomes/remediation separately first; introduce new status values only for demonstrated workflow needs. | Exports, submissions, duplicate relationships and remediation are different events. |
| AI report policy | Continue deterministic reports initially. Amend ADR-027 before enabling reviewable AI-assisted report drafts. | V2 Reporting Agent conflicts with the current accepted no-AI-authored-report rule. |
| Historical provenance | Keep collection date/collector null when unknown; uploader/createdAt remain their actual meanings. | A backfill must not manufacture evidence provenance. |
| Knowledge trust | Public references, user notes, imported material, AI inference and human-approved decisions have distinct source/review types. | Similarity and fluent text do not establish truth or authorization. |
| Closure | Record human closure decision and rationale; define reviewer-only permissions explicitly if desired. | V1 closure is a human action, but not a separate reviewer approval workflow. |

## 4. Expand, backfill, validate and switch

### 4.1 Baseline and rehearsal

After implementation approval, prepare a dedicated restored staging database and copy or inventory of evidence storage. Never point preservation tests or `prisma migrate dev` at production.

Capture a manifest containing:

- Row counts and UUID sets for every current model, broken down by workspace where appropriate.
- Existing project/target/investigation parent relationships and cross-workspace anomaly queries.
- Scope versions, assets, activities, approvals and effective dates; active-target uniqueness.
- Evidence key, checksum, file name, size, redaction state, version, supersedes link and current finding associations.
- Conversation/message ordering, task metadata/output/events, summaries and original author types.
- Finding statuses, review records, approvals, severity and duplicate relationships.
- Report/template IDs, report finding order, revision Markdown hashes and JSON snapshots.
- Applied migration history and all custom constraints, partial indexes and installed extensions.

If anomalies exist, report them for review. Quarantine incomplete mappings or leave associations nullable; do not delete, silently merge tenants or invent approval. Snapshot physical evidence separately from database rows because PostgreSQL backup does not include object storage.

### 4.2 Additive schema expansion

Use new migrations to add new tables/columns/indexes. Initially use nullable associations or compatible defaults where V1 rows cannot supply values. Keep old application versions able to read and write required columns during rollout.

Prefer explicit foreign keys for knowledge sources, decisions and typed research relationships. Avoid arbitrary `{ entityType, entityId }` links as the sole integrity mechanism for authoritative evidence. For evidence-to-observation/hypothesis relations, use typed association tables or an equivalent design with real referential checks.

Include workspace ownership in new aggregates. Add compound tenant/parent constraints where practical; preflight historical data before validating them. For PostgreSQL custom SQL, document the invariant and preserve it in migration/rehearsal tests. Do not assume a regenerated Prisma diff recreates existing partial indexes or check constraints.

Do not add all 25 proposed tables at once. Create only models used by the milestone and implement versioned persistence contracts before storing new JSON forms.

### 4.3 Resumable backfill

Use bounded batches, stable source IDs, a progress cursor and idempotent upsert/mapping keys. Each batch records counts, failures and reconciliation state. A second run must produce the same associations without duplicating entities or decisions.

| Existing V1 source | V2 mapping | Preservation rule |
| --- | --- | --- |
| Workspace/User/WorkspaceMember | Retain as tenancy/identity roots | No tenant reassignment or role promotion. |
| Project | Legacy Engagement association plus existing Project | Keep project ID/slug/type/status and all URLs; retain `legacy_project` source identity for backfill. |
| Target and ScopeVersion | EngagementAsset and authorization/scope association | Keep target/scope IDs, original rules and attestations. Unverified/expired/revoked status never becomes authorized by mapping. |
| Investigation | Nullable engagement association and optional phase | Retain status and creator. Do not map COMPLETED to CONFIRMED. Ambiguous mappings remain unresolved. |
| Observations/Hypotheses/HypothesisObservation | Existing research records and knowledge/source links where useful | Retain relationship semantics, rejected hypotheses and confidence labels. Do not duplicate source text as approved knowledge automatically. |
| SessionSummary | Existing continuity record, optionally referenced by a knowledge document | Retain AI/HUMAN author type, sourceTaskId, prompt/model and original arrays. |
| Evidence | Existing row/object plus additive provenance and typed relationships | Keep checksums/keys/version. Collection metadata stays unknown unless actual source records prove it. Preserve placeholder file names. |
| Finding/VerificationReview | Existing lifecycle/reviews plus decision/source associations | Imported historical decisions reference the original review/audit event and original actor/time. A derived record is not a new approval. |
| AIConversation/AIMessage/AITask/AITaskEvent | Retain current history; associate richer run records for new tasks | Historical hashes/counts are not reconstructible snapshots. Mark old runs `legacy_context_unavailable`; do not fabricate prompts or complete inputs. |
| Report/ReportFinding/ReportTemplate/ReportRevision | Retain reports/templates/revisions; introduce new snapshot versions for future revisions | Do not rerender old Markdown or rewrite old JSON. Read legacy snapshot formats and preserve ambiguities. |
| AuditLog | Preserve all events; record migration events separately | No rewriting previous actors, timestamps or values. |

Backfill verification/research decisions only from source records that actually contain a decision. Do not turn every audit entry, chat message or AI summary into a ResearchDecision.

### 4.4 Compatibility reads and authoritative writes

Ship read adapters accepting legacy and new shapes. A missing engagement association must still allow authorized users to inspect legacy records and use non-testing documentation workflows. New engagement-dependent actions require an explicit valid association.

Choose one authority per operation. A read facade may combine old/new records; unrelated services must not dual-write independent finding decisions or AI statuses. Where a temporary dual-write is necessary, perform it transactionally with stable linking IDs and observe reconciliation failures.

Introduce flags for new engagement workflows, retrieval, staged agents and imports. Flags select behavior; they must never bypass permissions or scope checks. Roll out workspace by workspace after preservation checks.

### 4.5 Validate before tightening

Compare the post-migration manifest with the baseline. Verify old UUID sets, cardinalities, authorship, scope rules, object checksums and report content remain intact. New additive rows must reconcile to known source records.

Only make a column non-null or validate a new constraint once every relevant legacy row is mapped or a documented compatibility exception exists. Observe lock duration on realistic staging data; use bounded DDL and concurrent index strategies when justified by actual scale. SQL requiring nontransactional index creation must be rehearsed with the chosen Prisma deployment path.

There is no destructive schema contraction planned for the V1-to-V2 release. Removing obsolete compatibility paths requires a later approved migration with an independently demonstrated preservation case.

## 5. Incremental delivery sequence

| Milestone | V2 phase alignment | Deliverable and dependencies | Release gate |
| --- | --- | --- | --- |
| M0 — Audit and preservation specification | Phase 0 | This audit package; proposed contracts and baseline test inventory | User reviews and approves implementation scope. |
| M1 — Research Data Foundation | Phase 1 | Engagement/decision/relationship/source foundations and V1 invariant guards | Migration rehearsal, ownership checks, non-AI workflow preservation and resumable backfill. |
| M2 — Reliable execution and source capture | Supports Phases 2–3/5 | Exact-source context contracts, snapshots, ModelExecution attempts, stable admission keys, budget reservations and minimal durable runner | No valid result with incomplete task final state; replay/cancellation/failure recovery tested. |
| M3 — Research Knowledge Engine | Phase 2 | Document processing, chunks, exact filters, full-text search, ranking, optional pgvector and hybrid retrieval | Tenant filters precede ranking; source deletion/review invalidates derived indexes; measured retrieval fixtures pass. |
| M4 — Intelligence Orchestration V2 | Phase 3 | Logical context/pattern/hypothesis/evidence/verification agents; outputs, claim provenance, evaluations and reviewable adoption | Every claim references exact snapshot sources; human decisions remain separate. |
| M5 — Tool Result Ingestion | Phase 4 | JSON → CSV → SARIF parsers, raw/canonical records, reviewable duplicate/asset mappings | Unsupported formats fail clearly; retries preserve original records; no import auto-confirms findings. |
| M6 — Evidence and Finding Intelligence | Phase 5 | Collection provenance, evidence relations/assessments, richer finding review, remediation and retest documentation | Approved evidence basis survives changes; retest metadata references valid scope without executing tests. |
| M7 — Reporting and Product Integration | Phase 6 | Specialized templates, reviewed AI drafts if ADR permits, manual submission/outcome tracking and analytics | Approved revisions remain canonical; no automatic submission; original reports export unchanged. |
| M8 — Evaluation and hardening acceptance | Phase 7 | Live-model/retrieval evaluations, isolation, uploads, job reliability and measured performance | V2 §18 criteria demonstrated with test/evaluation evidence. |

Quality checks begin in M1; M8 is the final acceptance stage, not the first time isolation or AI output is tested. Evidence quality agents need M2 source capture and the evidence relationship/assessment foundations brought forward from M6 (backlog B25/B26), not merely a new prompt. Minimal queue infrastructure comes before chunking/import jobs and staged agents, despite its appearance later in the specification. Milestone numbers describe release themes; the backlog's explicit execution sequence governs cross-milestone prerequisites.

## 6. Reliable execution design within the monolith

Keep AITask as existing request identity. Introduce a minimal persistent runner contract for AI and non-AI jobs with claim ownership, lease expiry, heartbeat/progress, attempt number, next-run time, cancellation request and stable idempotency identity. The exact schema is an M2 design deliverable; no new queue schema is created by this audit.

The runner should:

- Persist admission before returning an asynchronous task ID; claim jobs atomically, using PostgreSQL locking/conditional updates.
- Recheck workspace/actor operation permissions and any applicable current scope when claiming work. Persist scope/source provenance; cancel or block new work on revocation.
- Reserve token budget atomically before provider calls, count each corrective/retry attempt, release unused reservations and record uncertain usage when provider failure prevents precise accounting.
- Save execution attempt, validated output, assistant message/summary associations, final task state and transactional completion events together where possible.
- Retry transient rate limits/provider/storage errors with capped backoff. Schema-invalid outputs have a bounded correction policy; permission denials are not retryable.
- Detect expired leases and recover abandoned work. Interrupted external requests may have executed; retain attempts and require deliberate retry policy rather than assuming no provider cost.
- Honor cancellation before provider calls and prevent cancelled output from becoming accepted research. Cooperative cancellation is not a guarantee of zero external processing.
- Expose authenticated task status/history/cancel operations and reuse the current task list/UI. SSE can notify progress; durable state remains authoritative.

Use small request-bound tasks until the runner is available; do not describe Next.js `after()` or an open SSE response as a durable queue. Retain deterministic in-process small PDF export unless measured workload warrants a job.

## 7. Context, knowledge and AI migration

First correct selected-source validation: assembly returns a typed manifest containing every included observation, hypothesis, evidence version, finding, decision and reference. Validation checks against that exact manifest, including compressed contexts. The full provider request budget includes system instructions, schemas, task instruction, messages and correction overhead.

Create snapshots at execution time with schema version, source IDs/versions/checksums, selection/truncation information and immutable content necessary for inspection. Apply an explicit retention/access policy to copied sensitive context; do not place evidence content in unrestricted logs. Record retrieval query/filter/ranking, prompt hash/version and each ModelExecution independently.

Add scoped knowledge reads before semantic search. Full-text/vector indexes are derived data and can be rebuilt. Embeddings must record provider/model/dimensions/source-chunk version, and exclude unreviewed sensitive material. Stale or inaccessible chunks must never become visible through the index.

If pgvector is unavailable, maintain exact/full-text retrieval and mark semantic search unavailable. Install/enable extensions only through an approved migration and deploy compatibility check; a separate vector database is not the fallback.

Refactor existing prompts into logical agent definitions gradually. Existing chat/recon/hypothesis/summary behavior remains available while richer tasks gain input/output/claim contracts. Independent verification receives source evidence and documented hypothesis, not merely an earlier agent's persuasive conclusion. The same provider with a fresh bounded context is sufficient initially; multi-provider routing depends on measured benefit.

Persist AI recommendations separately, then let a trusted human adoption operation create/update research records with source run/claim IDs. Adoption cannot set authorization, severity, confirmation or reportability outside the existing approval services.

## 8. Evidence, imports and reports

Add explicit finalization state so review cannot promote an object before size/MIME/checksum validation. Make promotion and cleanup resumable with recorded object-operation identity and reconciliation; an object store and PostgreSQL are not one transaction.

Protect original/versioned evidence referenced by reports, assessments, reviews and context snapshots. Logical withdrawal should hide future use without destroying the historical record; physical deletion follows a reviewed retention rule. Preserve any legal/privacy deletion requirements once those are defined, but do not guess a policy in the migration.

Imports retain the raw uploaded source and raw record identity plus parser/mapping version. Treat advisory severity/confidence as source assertions; reviewable adoption creates draft research records. Duplicate detection records candidates and reasons, never silently deletes or merges originals. Verify workspace/engagement/asset mappings on server-side adoption.

New report snapshots preserve the full finding/evidence/relationship association. Legacy snapshots remain readable, including ambiguous collapsed relationships. Keep old Markdown exactly as saved. AI-assisted drafts, if approved by a new ADR, carry model/prompt/run/source metadata and must pass human review before a confirmed report export.

Submission/outcome tracking records a human's external actions. Remediation/retest records preserve requested scope, authorization version, supplied results and human decisions; they do not introduce target execution.

## 9. Risks and validation gates

| Risk | Required evidence before release |
| --- | --- |
| Legacy data silently gains authorization | Backfill fixtures for unverified, expired, revoked and ambiguous scopes; no authorization promotion from project type or mapping. |
| Cross-workspace joins or retrieval leaks | Two-workspace integration cases for every new relation, job, snapshot, chunk, import and adoption operation; no tenant-agnostic retrieval cache. |
| Lost report/evidence history | Baseline hashes/IDs preserved; old report exports and original object checksums checked after migration. |
| Concurrent decision overwrite | Competing review/status/link-removal/revision tests prove expected-state conditions and transaction invariants. |
| Duplicate/replayed provider/import work | Stable keys, unique admission, lease-expiry and crash-after-execution tests; attempt history explains uncertainty. |
| Unbounded context or retrieval | Large realistic fixtures demonstrate bounded database reads, complete request budgets and exact-source citation validation. |
| Unsupported model claims | Controlled contradictions, false positives, incomplete evidence, invalid citations and injection fixtures; quality results separate from schema validity. |
| Slow/locking migration | Restored-data rehearsal, extension privileges, SQL constraint/index inspection, and deploy-time lock monitoring. |
| Existing policy drift | ADR amendments for AI reporting, closure and lifecycle semantics; preserved compatibility behavior tested. |

Current audit baseline: TypeScript and lint passed; all 188 unit tests passed with one worker. The initial default-worker run hit startup/test timeouts. Integration/browser/live-model tests were not run during the audit. Implementation must exercise relevant integration and preservation tests in a disposable environment; unit success alone does not establish migration safety.

## 10. Rollout and recovery

For each milestone: expand schema → deploy compatible readers/writers → run backfill → reconcile → enable by workspace → observe → tighten only validated invariants.

If a feature fails, disable its workflow flag and keep the additive data. Revert application behavior to compatible V1 paths where safe; stop new jobs, preserve in-flight attempt records, and reconcile object/database operations. Do not undo migration-created relationships by deleting data blindly.

Backups are a disaster-recovery safeguard, not the ordinary application rollback: restoring a pre-migration database after new writes can lose those writes. Before any restore, stop writers and plan reconciliation of subsequent database changes and object versions. Prefer a forward corrective migration for schema defects.

No dependency installation, migration execution, backfill, object modification or code change occurs until the user approves an implementation milestone.
