# Sentinel Research V2 implementation backlog

Status: historical audit backlog; the user subsequently authorized implementation with “build v2”. Audit date: 2026-11-07. See [implementation status](V2_IMPLEMENTATION_STATUS.md) for delivered work, validation and remaining acceptance. Sources: [V1 audit](V1_ARCHITECTURE_AUDIT.md), [V2 gap analysis](V2_GAP_ANALYSIS.md), [migration plan](V2_MIGRATION_PLAN.md), and [V2 architecture](../technical-architecture-2.md).

Every item extends the existing monolith. Priorities: P0 protects data/authorization or blocks dependent work; P1 delivers core V2 capabilities; P2 completes later product integration or measured improvements. Size S/M/L is relative scope, not a delivery-date promise. Dependencies are ticket IDs. The tables preserve the audit's proposed acceptance criteria; completion is tracked in the implementation status document.

## 1. Completed audit and first approved delivery

**B00 — Architecture audit package** is completed by these four documents. Source inspection, V2 mapping and preservation planning are complete. TypeScript/lint passed and all 188 unit tests passed with one worker. Database migrations, integration tests, browser verification and live-model evaluation were not performed.

Recommended first milestone: **M1 — Research Data Foundation with protected V1 invariants**, B01–B09. Review B01's concrete contracts and schema design before applying migrations. Split delivery into small reviewable changes; do not implement all V2 phases in one operation.

Ticket numbers identify workstreams. The following execution sequence honors cross-milestone dependencies; in particular, evidence foundations B25/B26 precede the Verification Agent B24.

| Delivery stage | Execution sequence |
| --- | --- |
| M1 foundation | B01 → B02 → B03 → B04 → B05 → B06 → B07 → B08 → B09 |
| M2 reliability | B10 → B11 → B12 → B13 → B14 → B15 |
| M3 knowledge and quality foundation | B16 → B17 → B18 if enabled → B19 → B20 |
| Evidence prerequisites brought forward | B25 → B26 |
| M4 logical agents | B21 → B22 → B23 → B24 |
| M5 imports | B27 → B28 → B29 |
| M6 human review and remediation | B30 → B31 |
| M7 reporting/product | B32 → B33 if reporting policy permits → B34 |
| M8 acceptance | B35 → B36, for all enabled capabilities |

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 1 | B01 — Compatibility and domain decisions | P0 / M | User approval | ADRs define engagement/project cardinality, scope authority, analytical phase/status, review/run identity, human closure and legacy provenance. ADR-027 reporting policy is retained until explicitly amended. No destructive conversion is proposed. | G02–G06, G15, G75, G85; audit A07/A16 |
| 2 | B02 — V1 preservation manifest and migration rehearsal harness | P0 / M | B01 | On a restored disposable database/object inventory, capture all 28 model UUID sets, tenant/parent relationships, approvals, scope rules, evidence hashes/keys, conversations/tasks/summaries, report Markdown hashes and custom SQL. Tests compare these after migration and report anomalies without deleting data. | G01, G112–G117; A07/A08/A16 |
| 3 | B03 — One evidence relationship mutation authority | P0 / M | B01 | Both existing finding/evidence action paths delegate to one application operation. Check workspace, investigation, archive state, evidence approval and finding state inside the mutation. Removing the last supporting item from an approved finding requires a recorded review decision; no silent downgrade. Existing UI paths remain usable. | G71, G81, G103; A05 |
| 4 | B04 — Consequential mutation and upload validation guards | P0 / M | B02/B03 | Add expected-state guards for finding review/status and report revision/approval; competing updates cannot overwrite newer decisions. Evidence activation requires completed size/MIME/checksum validation. Add operation/role policy where agreed, preserving quarantine protection and ordinary documentation. | G74–G81, G112, G114; A06/A09/A15 |
| 5 | B05 — Minimal engagement domain and scope associations | P1 / L | B01/B02 | Add approved engagement/asset/authorization schema and services with tenant/parent constraints. Link existing ScopeVersion IDs. Document unverified targets; reject invalid engagement-dependent testing requests. Preserve one-active-scope-per-target rule. Existing Project/Target IDs and URLs remain unchanged. | G02–G06, G46, G113 |
| 6 | B06 — Research decisions and investigation relationships | P1 / M | B05 | Add attributable decisions with rationale, supporting/contradictory source links and typed investigation relationships. Human decisions and AI recommendations are distinct. Rejected hypotheses/history persist. Cross-workspace relationships and unauthorized decision writes fail. | G11, G13–G16, G79–G80 |
| 7 | B07 — Knowledge source/document/relation foundations | P1 / M | B05/B06 | Add source provenance, document version and review/source type; publication/retrieval dates and URL remain optional where unknown. Existing evidence/observations remain source authorities. No AI output becomes established knowledge automatically; no remote source fetcher or embeddings yet. | G17–G23, G100 |
| 8 | B08 — Resumable legacy mappings and compatible readers | P0 / M | B05–B07 | Bounded idempotent backfill associates legacy projects/investigations and source decisions without changing UUIDs, statuses, scope approval or author types. Unknown collection/context data is marked unavailable. Legacy reads and manual workflows work before/after mapping. Second run creates no duplicate mappings. | G02, G13, G54, G68–G69; A08/A16 |
| 9 | B09 — M1 preservation and permission acceptance | P0 / M | B02–B08 | Compare manifests; retain original Markdown/evidence checksums and history. Run targeted unit/integration and authenticated workflow checks in disposable environments. New relation/decision writes cannot cross workspaces. Publish migration reconciliation and scope/role results for milestone review. | G01, G112–G118; V2 §18 |

## 2. Reliable AI execution and source capture — M2

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 10 | B10 — Exact-source context and citation contract | P0 / M | B06/B07 | Context assembly returns selected IDs/versions for observations, hypotheses, evidence, findings, decisions and references. Validate citations only against that manifest, including compressed contexts. Add bounded database reads and full-request budgeting. A loaded-but-omitted ID and a foreign evidence ID both fail validation. | G49–G55, G97/G99; A01/A02 |
| 11 | B11 — Context snapshots and model execution attempts | P0 / L | B10 | Associate immutable versioned context/selection/source manifest and prompt hash with AITask. Persist each provider/corrective attempt, usage, status, provider identifiers where available, and sanitized errors. Old tasks remain readable with explicit missing historical context. Snapshot access follows workspace/evidence policy. | G54, G95/G111; A02/A11 |
| 12 | B12 — Idempotent admission and token reservations | P0 / M | B11 | Stable operation keys reuse an admitted task; duplicate HTTP requests do not create duplicate accepted runs. Reserve budgets atomically, include corrective/retry calls, reconcile actual usage and record uncertain provider cost. Concurrent requests cannot bypass the daily cap. | G52, G94, G110; A04 |
| 13 | B13 — Atomic result and task completion | P0 / M | B11/B12 | Validated output, message/summary source linkage, final task state and completion events persist consistently. Failure at each write stage cannot leave a valid untracked result or lose a human research decision. Provider-envelope/tool-name/schema errors remain explicit. | G12, G79, G94/G95; A03/A07/A11 |
| 14 | B14 — Minimal database-backed job runner | P0 / L | B12/B13 | Add atomic claim, lease, attempt/backoff, progress, heartbeat and safe cancellation using the same application/database. Recover abandoned jobs; recheck current permissions and relevant scope. Test crash-after-provider, expired lease, concurrent claim, retry exhaustion and cancelled-result rejection. Retain request-bound V1 operation until async rollout is proven. | G106–G110; A03/A04 |
| 15 | B15 — Task operation APIs, UI and production readiness | P1 / M | B14 | Authenticated task/status/events/cancel endpoints and existing task-history UI expose durable state. Empty/ended SSE without completion is not success. Production missing AI configuration returns a clear unavailable state; deployment validation and admission limits are active. Manual workflows remain useful. | G42/G43, G94, G120/G121; A10 |

Reuse AITask/AITaskEvent and the existing provider interface. Introduce new run/step records only where a stateful workflow needs them. Do not build a generic workflow language or independent agent services.

## 3. Research Knowledge Engine — M3

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 16 | B16 — Document processing and versioned chunks | P1 / M | B07/B14 | Process approved supplied documents into bounded chunks with source offsets, document/checksum/version and review metadata. Preserve original material; retries do not duplicate chunks. Revoked/deleted/inaccessible sources stop contributing to future context. | G20/G22, G107; KnowledgeChunk |
| 17 | B17 — Scoped exact/full-text knowledge retrieval | P1 / M | B16 | Workspace/engagement/review filters precede search/ranking. Add PostgreSQL full-text search and deterministic ranking/deduplication. Record query, filters, source IDs/scores and retrieval provenance. Two-workspace fixtures and known-answer queries pass. | G24/G25/G27, G30/G55; RetrievalRecord |
| 18 | B18 — Optional pgvector and hybrid retrieval | P1 / L | B17 | Check extension support on target PostgreSQL; implement versioned embeddings/model/dimensions and bounded jobs. Combine exact/full-text/semantic results with evaluated ranking. No semantic similarity auto-merges vulnerabilities. Exact/full-text continues when vectors are unavailable. | G26–G28; V2 §4.3 |
| 19 | B19 — Layered context and relevant research history | P1 / M | B10/B17; B18 if semantic enabled | Build workspace/engagement/project/investigation/session/reference layers including explicit decisions, findings and prior reviews. Summaries identify their actual session/source. Fresh scope validity and relevant history replace recency-only selection. Persist selection/truncation rationale. | G32, G44–G55; A02/A14 |
| 20 | B20 — Evaluation dataset and deterministic quality criteria | P0 / M | B10/B17 | Establish reviewed supported/unsupported/contradictory/duplicate/ambiguous/severity/injection fixtures. Measure selected-source citation accuracy, output validity, uncertainty and retrieval relevance separately. Version dataset/prompts/models; quality checks run before accepting new agents. | G97–G101, V2 §11 |

Embedding dependencies or pgvector migration require their own implementation review; neither is installed or enabled by this audit. No separate vector database is planned.

## 4. Logical intelligence agents — M4

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 21 | B21 — Agent contracts and staged orchestration | P1 / M | B11/B14/B19/B20 | Refactor `runAiTask` into bounded responsibilities; define agent input/output/claim schemas, permitted operations and prompt versions. Link runs/steps to task identity and exact context. User-initiated staged workflow survives retries; no agent scope/approval/execution authority. Existing four tasks retain behavior. | G29–G31, G38–G40, G103 |
| 22 | B22 — Research Context and Pattern Analysis agents | P1 / M | B21 | Context output cites relevant history/knowledge, missing context and confidence limits. Pattern output cites observations/references, alternatives and unestablished facts. Repeated-research and contradiction fixtures demonstrate behavior; pattern matches remain leads. | G32/G33 |
| 23 | B23 — Hypothesis Development and reviewable adoption | P1 / M | B21/B22/B06 | Extend current hypothesis prompt with assumptions, expected/observed behavior, alternatives, evidence requirements and relationships. Human adoption records source run/claim IDs and creates only permitted hypothesis/observation states. Reject fabricated IDs and unauthorized transitions. | G34/G41/G99; A01 |
| 24 | B24 — Evidence Analysis and independent Verification agents | P1 / L | B21/B20/B26 | Enable defined review tasks using actual finding/evidence/history inputs. Persist evidence assessment and recommendation separately from human review. Fresh verification context challenges unsupported impact/severity and contradictions. AI cannot record human CONFIRMED or approve reportability. | G35/G36/G73/G80/G97 |

B24 intentionally depends on evidence relationships/assessment foundations (B26). It must not be implemented as simply setting currently null `promptId` values. B22/B23 can release earlier.

## 5. Evidence and ingestion foundations — M5/M6

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 25 | B25 — Evidence version provenance and durable storage operations | P0 / L | B04/B05/B14 | Add real collection/collector/source provenance and reviewed replacement workflow while preserving uploader/createdAt semantics. Promotion/cleanup is resumable; protect objects referenced by historical reports/reviews/snapshots. Failure-injection tests reconcile DB/object state without deleting originals. | G67–G70/G114/G115; A08/A15 |
| 26 | B26 — Typed evidence relationships and assessment records | P1 / M | B06/B25 | Link evidence versions to observations/hypotheses and several findings with explicit support/contradiction/context. Add source-linked AI/human assessment records with review state. Enforce tenant/investigation consistency and immutable assessment basis; existing EvidenceLink remains usable. | G10/G71–G73/G80 |
| 27 | B27 — Import jobs, canonical records and JSON parser | P1 / L | B05/B14/B25 | Persist raw file/record, parser/mapping version and canonical source/tool/asset/location fields; JSON import runs in a durable job. Invalid/malformed/oversized records fail safely. Replays retain originals and do not duplicate adopted observations/findings. | G56/G57/G60–G62 |
| 28 | B28 — CSV and SARIF parsers | P1 / M | B27 | Implement explicit CSV field mapping/encoding limits and documented SARIF version handling. Fixtures cover missing fields, nested records, malformed content, duplicate source IDs and unsupported versions. Do not equate generic JSON upload with SARIF support. | G58/G59 |
| 29 | B29 — Import duplicate, asset mapping and researcher review | P1 / M | B27/B26/B17 | Multi-signal duplicate candidates retain reasons and source identities. Researcher approves engagement/asset mapping and adoption into draft research. Cross-workspace or invalid-scope mapping is blocked; no silent record deletion, merge or confirmation. Reuse existing finding similarity/human duplicate review. | G63–G65/G28 |
| 30 | B30 — Rich human finding review and closure | P1 / M | B06/B26/B04 | Evolve VerificationReview/FindingReview with explicit source/assessment/claim links and human decisions. Preserve existing review IDs and conclusions. Record more-research/closure rationale; concurrent AI/human activity cannot overwrite decisions. Define any additional role restrictions through B01 policy. | G74–G81 |
| 31 | B31 — Remediation and authorized retest documentation | P1 / L | B05/B30 | Add remediation plan/status, human-requested retest association to explicit scope/authorization version, supplied results and closure review. Expired/revoked authorization blocks new testing-related requests. This ticket records/manages work and results; it introduces no autonomous test execution. | G77/G78 |

B25/B26 are brought forward because quality agents and provenance-preserving imports depend on them. The architecture's phase names do not override these implementation dependencies.

## 6. Reporting and product integration — M7

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 32 | B32 — Report snapshot integrity and output profiles | P1 / M | B26/B30 | New snapshots retain finding/evidence/relationship/version/checksum associations; legacy snapshots decode without rewriting. Add bug-bounty/formal-audit profiles using existing template engine. Resolve direct GET/first-export audit behavior; repeat downloads remain read-only. Original approved Markdown/PDF exports remain available. | G82–G84/G86/G87; A13 |
| 33 | B33 — Reviewed Reporting Agent drafts | P1 / M | B21/B24/B32; explicit ADR-027 amendment | Enable reporting/finding-summary tasks only after source-backed schema/quality checks and reporting-policy change. AI drafts carry run/prompt/model/source metadata and human edits; no invented reproduction/impact. Human approval remains mandatory before confirmed export. | G37/G85/G99 |
| 34 | B34 — Manual submission/outcome tracking and analytics | P2 / M | B29/B31/B32 | Record human-entered submitted/accepted/duplicate/informational events linked to report/finding. Show remediation/retest and research/knowledge/evidence-quality insights using existing dashboard/table components. Export does not auto-create submission or acceptance. | G76/G88/G89 |

## 7. Final evaluation and hardening acceptance — M8

| Order | Ticket | Priority / size | Depends on | Outcome and acceptance criteria | Evidence/gaps |
| --- | --- | --- | --- | --- | --- |
| 35 | B35 — Measured agent/retrieval evaluation and regression gates | P0 / L | B20/B22–B24/B29/B33 | Run controlled evaluations with approved datasets; report unsupported claim, citation, false-positive, duplicate, uncertainty, retrieval and reviewer-agreement metrics per model/prompt version. Compare to baseline; define approved release thresholds from measured results. Do not invent percentage guarantees. | G97–G101; V2 §18 |
| 36 | B36 — Tenant/scope/upload/job reliability and performance acceptance | P0 / L | All enabled milestone tickets | Run disposable migration-preservation tests, authenticated direct-operation checks, cross-workspace retrieval/jobs, revocation/expiry/exclusion tests, upload activation/retention failures, concurrent lifecycle and replay/cancel tests. Measure query/context/job latency and monitor stuck runs/budget/cleanup failures. | G112–G121; A03–A16 |

## 8. Explicitly deferred options

These capabilities are missing or incomplete but are not prerequisites for the first V2 release:

| Option | Entry criterion | Existing reusable foundation |
| --- | --- | --- |
| Named Nmap/ZAP/Burp/Semgrep/Trivy adapters | Select a supported documented export format and add compatibility fixtures after B27–B29. | Canonical import contract and generic parsers. |
| Additional model providers/capability discovery | A real consumer or measured quality/latency/cost improvement justifies the interface extension. | Existing provider-neutral request/response and task profiles. |
| Dedicated Inngest/Trigger.dev job platform | Measured runner/scheduling/concurrency limitations justify migration and operational dependency. | Persistent job identities, attempts/events and idempotent operations. |
| Integration credential encryption/BYOK | A selected integration actually requires persisted user credentials; approve secret ownership/rotation/retention design first. | Server configuration and currently unused AIProviderConfig credential reference. |
| Team workspace UX | Product scope approves invitations/switching; operation/role and evidence visibility policies are tested first. | Existing WorkspaceMember and role schema. |
| Advanced knowledge graph or model routing | Retrieval/evaluation evidence demonstrates incremental benefit. | Relational source/knowledge links and measured hybrid retrieval. |

Microservices, separate graph/vector databases, independent autonomous testing agents, unrestricted browser/terminal execution, automatic findings confirmation and automatic external submission are excluded from this backlog.

## 9. Review and completion rules

Each implementation item must explain the changed behavior, reused modules, data migration impact, rollback behavior and relevant validation evidence. Database changes require restored-V1 preservation tests as well as isolated repository tests; consequential permission/lifecycle changes require direct-operation and concurrency cases.

Use current application routes/services/components as the compatibility contract. Do not replace an existing component merely to match the V2 suggested directory tree. UI composition should extend the existing shared research console and expose understandable source/decision information rather than internal implementation detail.

No production migrations, dependency installation, application edits or external actions are part of this audit delivery. The next step is user approval of M1 and its proposed contracts.
