# Sentinel Research V2 gap analysis

Audit date: 2026-11-07. Comparison target: [Revised Technical Architecture — V2](../technical-architecture-2.md), all sections 1–20. Evidence is the pre-implementation V1 working tree, as documented in the [V1 audit](V1_ARCHITECTURE_AUDIT.md). These classifications preserve that historical baseline; see [V2 implementation status](V2_IMPLEMENTATION_STATUS.md) for subsequent delivered work. Existing names were mapped by behavior: Project supplies some engagement responsibilities, ATTACK_SURFACE_ANALYSIS implements investigation chat, VerificationReview supplies much of finding review, and AITask/AITaskEvent supply execution foundations.

## 1. Classification and evidence conventions

Each row gives the primary status of the stated capability, not merely whether a table or enum exists.

| Classification | Meaning |
| --- | --- |
| Already implemented | A usable path exists and fulfills the stated capability; adjacent improvements may still be required. |
| Partially implemented | A usable subset or meaningful foundation exists, but the complete capability does not. |
| Missing | No implementation of the capability was found. Uploading a file or declaring an enum does not establish the corresponding workflow. |
| Implemented but architecturally weak | The capability runs, but identified boundaries, invariants, provenance or reliability are insufficient for V2. |
| Requires refactoring | Existing behavior should be retained, but its contract/responsibilities must evolve to meet V2. |

Evidence keys keep the tables readable. Paths are repository-relative.

| Key | Primary source |
| --- | --- |
| S1 | `prisma/schema.prisma` and all three `prisma/migrations/*/migration.sql` files |
| S2 | `src/lib/session.ts`, `src/proxy.ts`, `src/modules/auth/{application,infrastructure}`, workspace ownership/overview stores |
| S3 | `src/modules/research/application/{project,target,scope,investigation}-service.ts`, corresponding domains and `prisma-research-store.ts` |
| S4 | `src/modules/security/domain/capability.ts`, `src/modules/research/domain/scope-validator.ts` |
| S5 | `src/modules/ai/application/task-service.ts`, `domain/ai-config.ts`, `domain/ai-budgets.ts`, `domain/ai-errors.ts` |
| S6 | `src/modules/ai/application/context-manager.ts`, `application/ports.ts`, `infrastructure/prisma-ai-store.ts` |
| S7 | `src/modules/ai/domain/structured-output.ts`, `prompts/registry.ts`, `infrastructure/anthropic-provider.ts`, provider factory/interface |
| S8 | `src/modules/evidence/{domain,application,infrastructure}`, evidence actions and API routes |
| S9 | `src/modules/findings/{domain,application,infrastructure}`, `src/modules/verification/domain/verification-conclusion.ts` |
| S10 | `src/modules/reports/{domain,application,infrastructure}`, report/template actions and export API; ADR-027 |
| S11 | `src/components/{ai,research,shared,ui}`, dashboard/settings pages and audit stores |
| S12 | `tests/unit`, `tests/integration`, `tests/e2e`, their configs/global setup, `src/config/env.schema.ts` |

## 2. Research domains and knowledge — V2 §§1–4

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G01 | Modular monolith with useful non-AI research workflows | Already implemented | S2/S3/S8/S9/S10. Preserve manual research, evidence review, finding review and deterministic reports. |
| G02 | Engagement creation, type, objectives and status | Partially implemented | S1/S3. Project type/status/description and investigation objective overlap; no distinct engagement domain or engagement-level objective. |
| G03 | Engagement associations to projects, targets and assets | Partially implemented | S1/S3. Project → Target and Investigation → Target exist; engagements and multi-asset engagement membership do not. |
| G04 | Engagement authorization records, dates, scope, exclusions, restrictions and activities | Partially implemented | S1/S3/S4. ScopeVersion, ScopeAsset, ScopeActivityRule and target attestation supply most primitives; engagement association and authorization-artifact workflow remain. |
| G05 | Active authorized engagement gates every testing-related task | Partially implemented | S4. Action-time target scope gate exists; testing capabilities fail closed. Add engagement gate for any future testing-related task; supplied-content analysis remains distinct. |
| G06 | Document unverified targets without initiating testing | Already implemented | S3/S4; ADR-024. Investigation documentation is permitted while testing capabilities remain disabled. |
| G07 | Structured investigation independent of conversation | Already implemented | S1/S3. Persistent investigation with observations/hypotheses/evidence/findings and summaries. |
| G08 | Initial observation and multiple related assets on an investigation | Partially implemented | S1/S3. Observations and a single target exist; no designated initial observation or additional asset associations. |
| G09 | Engagement context and research objectives | Partially implemented | S3. Project/target/objective context exists; engagement linkage must be added. |
| G10 | Supporting and contradictory research relationships | Partially implemented | S1/S3/S8/S9. HypothesisObservation and EvidenceLink already distinguish relationships; evidence-to-observation/hypothesis associations are missing. |
| G11 | Related historical research and investigation relationships | Missing | S1/S6. No cross-investigation relationship or retrieval implementation. |
| G12 | Durable AI analysis records in investigations | Implemented but architecturally weak | S5/S6. Tasks/messages persist, but exact input, per-attempt output, claim citations and direct message/task linkage are incomplete. |
| G13 | Research decisions with rationale and attributable human authority | Partially implemented | S3/S9. Audit logs, reviews, rejection reasons and summaries exist; a first-class decision history is missing. |
| G14 | Structured unresolved questions and final outcome | Partially implemented | S1/S3. Summary arrays and terminal statuses exist; explicit outcome and decision associations remain. |
| G15 | ContextGathering/Analysis/HypothesisDevelopment/EvidenceReview/Reporting stages | Requires refactoring | S3. Existing lifecycle is draft/active/paused/review/completed/archive; add analytical phase without destructive status conversion. |
| G16 | Retain rejected hypotheses and completed investigation history | Already implemented | S1/S3/S6. Rejected hypotheses and summaries persist; archive behavior preserves records. Future deletion must retain this property. |
| G17 | Investigation knowledge: observations, hypotheses, evidence and summaries | Already implemented | S1/S3/S8. Existing records are the knowledge foundation, not data to replace. |
| G18 | Engagement knowledge shared across investigations: issues, limitations and history | Partially implemented | S3/S6. Project groups investigations and scope; no reusable knowledge/read contract across them. |
| G19 | Curated classifications, concepts, advisories, CVEs, write-ups, standards and remediation references | Missing | S1/S6. Category text is not curated research reference knowledge. |
| G20 | Reference provenance: original source, publication/retrieval dates and URL | Missing | S1. Evidence's source string is insufficient for reference-source provenance. |
| G21 | User knowledge: prior patterns, rejected hypotheses, lessons, notes and workflow preferences | Partially implemented | S1/S3. Preferences and personal records exist; no reusable user-knowledge library or retrieval. |
| G22 | Knowledge provenance and confidence/review status; AI suggestions not established facts | Partially implemented | S1/S7/S11. Observation confidence and AI/human labels exist; knowledge records/review lifecycle are missing. |
| G23 | PostgreSQL source of truth and relational knowledge links | Partially implemented | S1. Existing relations are reusable; generalized KnowledgeDocument/Source/Relation absent. |
| G24 | Exact tenant-filtered retrieval | Already implemented | S2/S3/S6. Scoped record lookup is real; reuse it as the first retrieval filter. |
| G25 | PostgreSQL full-text search | Missing | S1/S6. `pg_trgm` finding-title similarity is not full-text search. |
| G26 | pgvector semantic retrieval and embedding metadata | Missing | S1. No vector extension, vector columns, chunking or embedding workflow. |
| G27 | Hybrid retrieval, relevance ranking, recency and context deduplication | Missing | S6. Current bounded recency selection is a precursor, not hybrid retrieval. |
| G28 | Reviewable duplicate identity rather than semantic similarity as proof | Already implemented | S9. Finding similarity suggestions require human duplicate confirmation. Extend this rule to imported/knowledge records. |

## 3. Intelligence orchestration and agents — V2 §5

These are logical analytical agents within the monolith. V1's specialized prompts count as precursors even though no `AgentDefinition` table exists.

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G29 | Central task orchestration, permissions, model selection, context, validation and saving | Requires refactoring | S5. `runAiTask` already orchestrates these operations; split at necessary admission/context/execution/evaluation/persistence seams. |
| G30 | Relevant knowledge retrieval during orchestration | Missing | S6. No knowledge store or retrieval engine. |
| G31 | Task classification and routing to responsibility-specific analysis | Partially implemented | S5/S7. Explicit task profiles/roles/prompts work; user-intent classification and staged workflows do not. |
| G32 | Research Context Agent: summaries, past observations, unresolved questions and source package | Partially implemented | S6/S7. Context builder and summary assistant cover local continuity; relevant history, confidence, repeated-research detection and reference retrieval remain. |
| G33 | Pattern Analysis Agent: classifications, related observations, public references and alternatives | Partially implemented | S5/S7. Recon/chat can provide advisory analysis; no specialized pattern schema, retrieval or traceable alternative-explanation workflow. |
| G34 | Hypothesis Development Agent: statement, supporting observations, missing information and evidence needs | Partially implemented | S5/S7. Executable hypothesis-generation schema; add assumptions, expected/observed behavior, alternative explanations, relationships and decision-linked adoption. |
| G35 | Evidence Analysis Agent: quality, contradictions, impact, duplicates, provenance and sensitive material | Partially implemented | S7/S8. Validation/redaction scanner and disabled review schema exist; no executable evidence-analysis task or persistent assessment. |
| G36 | Verification Agent: independent challenge, alternatives, impact/severity support and recommendation | Partially implemented | S7/S9. Human review is usable; AI verification schema/roles exist but EVIDENCE_REVIEW/FALSE_POSITIVE_REVIEW have no prompts and cannot run. |
| G37 | Reporting Agent: approved-data descriptions, evidence, impact, remediation and report formats | Partially implemented | S7/S10. Deterministic approved-data reports are reusable; AI reporting/finding-summary profiles are disabled. ADR-027 currently excludes AI-authored report content. |
| G38 | Agent-specific input/output schemas, operation allowlists and responsibility boundaries | Partially implemented | S4/S5/S7. Task profiles and Zod outputs exist; richer inputs, allowed data/write contracts and all six agents remain. |
| G39 | Context → retrieval → analysis → quality review → persistence → human review stages | Partially implemented | S5/S6. Single-task context/analysis/schema validation/persistence exists; retrieval, independent quality stage and adoption decision are absent. |
| G40 | Multi-stage dependencies and independent review with recorded agent runs/steps | Missing | S5. Task retry ancestry is not a staged agent workflow. |
| G41 | Human review for consequential outputs; agents cannot scope/approve/submit | Already implemented | S4/S9/S10. Current AI produces suggestions and summaries only. Extend the existing boundaries to every new agent. |
| G42 | Persistent guided conversations | Already implemented | S5/S6/S11. Real USER/ASSISTANT history and task-backed responses. |
| G43 | Delegated mode as bounded researcher-initiated analysis | Partially implemented | S5/S11. Recon/hypothesis/summary buttons execute tasks; mode tabs do not persist a different workflow policy and conversations default GUIDED. No autonomous delegation exists. |

## 4. Context engineering — V2 §6

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G44 | Global instructions, safety constraints and output rules | Already implemented | S7. Central versioned prompts, restrictions and structured tool schemas. |
| G45 | Workspace preferences/configuration in context | Missing | S1/S6. User preference columns exist but are not loaded into AI context. |
| G46 | Engagement authorization, scope version and restrictions in context | Partially implemented | S6. Target and scope rules exist; engagement and clock-valid authorization context do not. |
| G47 | Project targets, assets and assessment history | Partially implemented | S6. Current project and one target; no broader asset/history retrieval. |
| G48 | Investigation observations, hypotheses and approved evidence | Already implemented | S6. Bound and serialize these records; binary evidence is honestly metadata-only. |
| G49 | Findings, prior reviews and explicit decisions in context | Missing | S6. `AiContextRecord` does not carry them. |
| G50 | Recent conversation and current task context | Partially implemented | S6. Chat receives recent turns; other task types do not, and summary actions have no selected conversation. |
| G51 | Public reference sources and related investigations | Missing | S6. No retrieval or source records. |
| G52 | Bounded context, compression and token limits | Implemented but architecturally weak | S5/S6. Selection/truncation and thresholds exist; database reads are largely unbounded and complete provider/correction request tokens are not budgeted. |
| G53 | Preserve identifiers of exactly supplied sources | Implemented but architecturally weak | S5/S6/S7. Context includes IDs and a hash; validator checks all loaded IDs, not only selected ones, and persists only evidence ID/version plus counts. |
| G54 | Immutable context package/snapshot for replay and inspection | Partially implemented | S5/S6. Hash and metadata exist; exact context/messages/source manifest are not retained. |
| G55 | Rank, remove irrelevant/duplicate context and select prior decisions | Missing | S6. No relevance scores, query history, retrieval record or explicit decisions. |

## 5. Tool integration and ingestion — V2 §7

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G56 | Secure supplied-result file upload and validation | Partially implemented | S8. Evidence upload accepts JSON/text and other permitted types; no import lifecycle, parsers or canonical mapping. |
| G57 | JSON import parser | Missing | S8. MIME detection and generic JSON evidence upload do not parse findings. |
| G58 | CSV import parser | Missing | S8. Generic text handling is not a CSV record parser. |
| G59 | SARIF import parser | Missing | S1/S8. No SARIF schema/version handling. |
| G60 | Canonical ImportedFinding and explicit source/classification/asset/location mapping | Missing | S1. Source tool, raw record, source ID, mapping and advisory severity import contracts absent. |
| G61 | Original raw records retained beside normalized records | Missing | S8. Original evidence files can persist, but no raw-to-canonical import lineage exists. |
| G62 | Persistent ImportJob status, progress, retries and review | Missing | S1/S5. AITask is AI-specific and is not an import job. |
| G63 | Multi-signal import duplicate detection and reviewable candidates | Partially implemented | S9. Existing finding title/category similarity and human confirmation are reusable; import source/asset/location/evidence signals are missing. |
| G64 | Import asset/engagement association and context enrichment | Missing | S1. No import mapping, engagement linkage or enrichment stage. |
| G65 | Imported results remain unconfirmed until human review | Partially implemented | S9. Existing findings start DRAFT and require review; no import adoption path yet. Preserve this rule when importing. |
| G66 | Nmap, ZAP, Burp, Semgrep, Trivy and other documented adapters | Missing | No tool-specific parsers/tests. These are candidate incremental integrations, not all required for the initial release. |

## 6. Evidence, findings, remediation and reporting — V2 §§8, 16

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G67 | Evidence ID/investigation/type/source/checksum/description/private original file/redaction | Already implemented | S1/S8. Existing metadata, active/quarantine keys, uploader and review timestamps are substantial provenance. |
| G68 | Explicit engagement, collection date and collector provenance | Partially implemented | S1/S8. Uploader/createdAt are known; they must not be reinterpreted as collector/collection date. Engagement association and collection fields absent. |
| G69 | Evidence versions, replacements and preserved original lineage | Partially implemented | S1/S8. Version/supersedes/checksum fields exist; no replacement workflow or historical-object retention guard. |
| G70 | Screenshot/log/config/source/research-note/import-report evidence categories | Partially implemented | S1/S8. Many existing EvidenceType values and text/binary MIME types cover these; tool/import origin and richer classification remain. |
| G71 | Evidence relates to multiple findings with support/contradiction/context/reproduction | Already implemented | S1/S8/S9. EvidenceLink is explicit and many-to-many. |
| G72 | Evidence relates to multiple observations and hypotheses | Missing | S1. HypothesisObservation links observations to hypotheses, not evidence. |
| G73 | Evidence relevance/quality/contradiction/provenance assessments | Missing | S8. Redaction review and sensitive-text counts are not an EvidenceAssessment. |
| G74 | Draft → validation → review → confirmed/false-positive/rejected → reportable | Already implemented | S9. Human confirmation and reportability/readiness gates exist. |
| G75 | MoreResearch loop and attributable closure approval | Requires refactoring | S9. UNDER_REVIEW → NEEDS_VALIDATION already implements more research; CLOSED is terminal. Add decision-backed closure and richer phase semantics without renaming existing statuses blindly. |
| G76 | Submitted/accepted/duplicate/informational external outcome tracking | Missing | S9/S10. Internal duplicate rejection exists; report export is not external submission or program outcome. |
| G77 | Remediation planning/status and assigned remediation records | Missing | S1/S9. Finding remediation text is not a remediation workflow. |
| G78 | Authorized retest requests, result records and closure | Missing | S1/S4. No retest lifecycle; result documentation must remain separate from execution. |
| G79 | Human findings decisions separate from AI recommendations | Already implemented | S9/S7. AI outputs are advisory and human review changes findings; extend traceable links between them. |
| G80 | Explicit review evidence references and reproducible approval basis | Implemented but architecturally weak | S1/S9. VerificationReview evidence is descriptive JSON arrays; approval does not retain a complete immutable source/decision snapshot. |
| G81 | Preserve readiness under link changes and concurrent edits/approval | Implemented but architecturally weak | S8/S9/S10. Guards exist at entry, but link removal and transaction-level compare-and-set are missing. See audit A05/A06. |
| G82 | Evidence-backed approved reports and revision history | Already implemented | S10. Deterministic drafts, human approval, readiness rechecks, saved Markdown and source snapshots. |
| G83 | General assessment/finding/reproduction templates and workspace template versions | Already implemented | S1/S10. Three seeded system templates and role-gated workspace templates. |
| G84 | Specific bug bounty and formal audit output profiles | Partially implemented | S10. Existing templates/Markdown renderer reusable; profile-specific fields and acceptance criteria absent. |
| G85 | AI-assisted reporting with traceable approved inputs | Requires refactoring | S7/S10; ADR-027. Disabled schema/profile exists. Amend existing no-AI-report policy explicitly before implementing draft assistance. |
| G86 | Markdown and derived PDF exports of approved revisions | Already implemented | S10. PDF is real, deterministic and in-process; standard fonts limit non-Latin glyph fidelity. |
| G87 | Lossless report finding/evidence relationship snapshots | Implemented but architecturally weak | S10. Evidence ID/version/checksum retained, but deduplication loses different relationship roles across findings. |
| G88 | Report submission tracking and remediation status integration | Missing | S9/S10. Track human-entered external events; do not introduce automatic submission. |
| G89 | Investigation analytics and intelligence dashboard | Partially implemented | S11. Existing counters, lists and audit/task history; no knowledge, duplicate, evidence-quality, retrieval or remediation insights. |

## 7. Proposed V2 persistence models — V2 §9

All **25 named new V2 tables are absent** from the current Prisma schema. The classifications below distinguish a missing physical table from reusable conceptual behavior. A new name is not sufficient justification for duplicate persistence authorities.

| V2 model/concept | Classification | Existing equivalent or migration recommendation |
| --- | --- | --- |
| Engagement | Partially implemented | Project is a partial behavioral equivalent. Add engagement association and preserve Project. |
| EngagementAsset | Partially implemented | Target and ScopeAsset cover asset/rule primitives. Add engagement membership, keep canonical target identity. |
| EngagementAuthorization | Partially implemented | ScopeVersion/AuthorizationArtifact/target attestation cover part of the contract. Associate existing scope; avoid a second scope authority. |
| KnowledgeDocument | Missing | Existing observations/evidence are source records; add documents without rewriting them. |
| KnowledgeChunk | Missing | Add versioned chunk/source offsets and optional embedding metadata. |
| KnowledgeSource | Missing | Add origin/publication/retrieval provenance and trusted source identity. |
| KnowledgeRelation | Partially implemented | HypothesisObservation/EvidenceLink cover specific existing relations. Preserve those while adding knowledge links. |
| ResearchDecision | Partially implemented | AuditLog/VerificationReview retain some decisions. Add explicit rationale/source associations without promoting AI outputs. |
| InvestigationRelation | Missing | Add typed relationships with same-workspace checks. |
| AgentDefinition | Partially implemented | Static AI_TASK_PROFILES, assistant roles and versioned prompts are a precursor; decide whether persistent definitions add value. |
| AgentRun | Requires refactoring | AITask already owns requester, status, prompt/model and output. Extend or associate it rather than competing status machines. |
| AgentRunStep | Requires refactoring | AITaskEvent records stages; distinguish stateful workflow steps from append-only events. |
| ContextSnapshot | Partially implemented | Existing context hash/input metadata need exact, versioned source snapshot persistence. |
| RetrievalRecord | Missing | Add scoped queries/results/ranking and snapshot associations. |
| ModelExecution | Partially implemented | AITask aggregates model/usage/output; add attempt-level requests/results/usage and provider IDs. |
| EvaluationResult | Missing | Existing Zod check events are a foundation, not quality evaluation records. |
| Integration | Missing | Add explicit documented import adapter identity/configuration; credentials only if necessary. |
| ImportJob | Missing | Add an import-specific workflow on a reusable job runner. |
| ImportRecord | Missing | Preserve original record and normalized representation separately. |
| ImportMapping | Missing | Record source-to-canonical mapping, asset/engagement association and parser version. |
| DuplicateCandidate | Partially implemented | Existing same-named TypeScript result and similarity query are real; persistent multi-signal review model is absent. |
| EvidenceAssessment | Missing | Add quality assessments linked to immutable evidence versions and reviewer/run. |
| FindingReview | Requires refactoring | VerificationReview is the existing review authority. Extend it or provide a compatible contract; avoid a second unconnected review history. |
| RemediationRecord | Missing | Keep existing remediation text; add workflow records. |
| RetestRecord | Missing | Add human-requested scoped retest documentation and resulting decisions, no autonomous testing. |

V2's preserve-list omits **six** existing ancillary models: ScopeAsset, ScopeActivityRule, AuthorizationArtifact, HypothesisObservation, ReportFinding and ReportTemplate. All six must also be preserved. The actual schema inventory, rather than the shortened specification list, governs preservation.

## 8. Provider, evaluation and provenance — V2 §§10–11

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G90 | Anthropic provider isolation and provider-neutral requests | Already implemented | S7. `AIProvider.generate` handles structured requests; interface naming differs without architectural incompatibility. |
| G91 | Configurable model selection per task | Already implemented | S5/S7. Sonnet/Haiku profiles and server overrides. No complex routing is needed initially. |
| G92 | Provider text/structured methods and model-capability discovery | Partially implemented | S7. Unified generate supports structured output and returns text; model-capability discovery absent. Extend only when a concrete consumer needs it. |
| G93 | Additional OpenAI/Google providers and measured model routing | Missing | S1/S7. Explicitly later work in V2; do not block initial Claude-only delivery or install unused provider SDKs. |
| G94 | Graceful timeout/rate-limit/refusal/provider failure handling | Implemented but architecturally weak | S5/S7. Stable codes and task failure states exist; durable recovery, admission limits and production misconfiguration handling remain. |
| G95 | Prompt/model/version and execution logging | Implemented but architecturally weak | S5/S7. Hash/version/model/events/usage exist; immutable request and per-attempt execution missing. |
| G96 | Output schema/size/value validity | Already implemented | S7. Zod schemas and one correction attempt; extend contracts to all new outputs. |
| G97 | Evaluation: evidence alignment, source traceability and factual consistency | Partially implemented | S7. Some ID membership checks exist; evidence IDs, selected-source checking, contradiction assessment and semantic support verification absent. |
| G98 | Evaluation: uncertainty, relevance, duplicate awareness and scope compliance | Partially implemented | S4/S7. Prompt rules and bounded warning/missing-info fields exist; persisted quality criteria/results are missing. |
| G99 | Claim-level type, support/contradiction IDs, confidence and limitations | Missing | S7. Existing result-level ID arrays and hypothesis confidence are not per-claim provenance. |
| G100 | Distinguish researcher, imported, AI, public reference and human-reviewed material | Partially implemented | S11. AI/researcher/review labels exist; import/reference source types and linked claim basis remain. |
| G101 | Controlled quality dataset and unsupported claim/citation/false-positive/duplicate/retrieval metrics | Partially implemented | S12. Deterministic mocks test schema/errors/injection fixtures; no measured live-model or retrieval quality dataset/pipeline. |
| G102 | Model-estimated confidence never determines proof/severity/approval | Already implemented | S7/S9. Advisory labels; status/severity/reportability require human service operations. |

## 9. Infrastructure, security and boundaries — V2 §§12–15

| ID | Proposed V2 capability | Classification | V1 evidence, remaining work and reuse |
| --- | --- | --- | --- |
| G103 | Domain/application/infrastructure separation and service-coordinated operations | Requires refactoring | S3/S5/S8/S9/S10. Existing layers are useful; cross-module direct reads and oversized research/AI modules need bounded seams. |
| G104 | No Prisma queries from presentation components | Already implemented | S11. `src/components` receives typed data; app routes compose concrete stores and sometimes use repository read methods directly. |
| G105 | Sensible repository abstractions, no interface per query | Already implemented | S3/S8/S9/S10. Existing contracts group use cases; preserve them and remove trivial duplication only when useful. |
| G106 | Persistent database-backed background task queue | Missing | S1/S5. AITask records execution but has no worker claim/lease/recovery. Reuse task identity, not an assumption that it is already a queue. |
| G107 | Background imports, document processing, chunking, embeddings and large retrieval | Missing | S1/S5. No durable job runner or those workflows. |
| G108 | Background multi-agent work, long report generation and evaluations | Missing | S5/S10. Current AI/Markdown/PDF work is request-bound. Small deterministic PDF export need not move unnecessarily. |
| G109 | Job status, progress, failure information and audit events | Partially implemented | S5/S6. AI task events/statuses exist; generic job/progress/history linkage absent. |
| G110 | Retry policy, safe cancellation, idempotency and recovery | Partially implemented | S5/S6. Retry lineage, cancellation status and unique idempotency field exist; operational APIs/runner/admission and stable keys absent. |
| G111 | Inspectable AI inputs, outputs and execution metadata | Implemented but architecturally weak | S5/S6. Task history exists; exact inputs and per-attempt traces missing. |
| G112 | Tenant and relationship isolation on every workspace record | Implemented but architecturally weak | S1/S2/S3/S6/S8/S9. Current service checks are substantial; redundant tenant IDs and some write contracts lack database/transaction invariants. |
| G113 | Immutable scope content and action-time expiry/revocation/exclusion checks | Partially implemented | S3/S4. Versioned content and clock-sensitive validator exist; database immutability, prefix-boundary hardening and engagement association remain. |
| G114 | Private evidence and validated, safely processed uploads | Implemented but architecturally weak | S8. Private storage/size/MIME/checksum are real; activation prerequisites, orphan cleanup, retention and larger untrusted-processing jobs need work. |
| G115 | Redaction before external model submission | Partially implemented | S8/S6. Only approved text evidence is hydrated; scanner is advisory and does not cover screenshots/PDF contents. Other supplied notes are untrusted and not automatically redacted. |
| G116 | Encrypted sensitive credentials and safe logs | Partially implemented | S7/S8. Server-owned credentials are not stored as user secrets; BYOK references unused. No general credential encryption subsystem; avoid creating one until integration secrets are actually needed. |
| G117 | Audit important changes and human decisions | Implemented but architecturally weak | S3/S8/S9/S10. Most writes are transactional with audit; direct export and multi-write AI lifecycle gaps remain. |
| G118 | Imported/external data never acts as orchestrator instructions | Partially implemented | S7. Untrusted delimiters, system rules, restricted capability model and output checks exist; parser/source isolation and measured injection tests for new flows remain. |
| G119 | Domain-oriented APIs and Server Actions | Already implemented | S3/S5/S8/S9/S10. Existing operations are suitable. V2's example REST paths are optional, not missing mandatory CRUD endpoints. |
| G120 | Intelligence task query/events/cancellation API | Missing | S5/S6. History can be read server-side; no operational task polling/event/cancel endpoints. |
| G121 | Production readiness, monitoring, limits and performance visibility | Partially implemented | S12. Env schema/usage metadata exist; production assertion is not called, rate limiter not implemented, and structured run/job monitoring absent. |

## 10. Deliberate exclusions and future options — V2 §17

| Proposed constraint or option | Classification | Interpretation |
| --- | --- | --- |
| Stay a modular monolith; no microservices | Already implemented | Preserve one deployable application; a runner using the same code/database is not a new domain service. |
| No independent autonomous agents, exploitation or automatic vulnerability confirmation | Already implemented | Existing AI has no execution tools and human gates. V2 analytical stages do not require autonomous testing. |
| No unrestricted terminal/browser operations or automatic external submission | Already implemented | Capability policy prohibits commands/submission and disables browsing. Track human submission events only. |
| No separate graph/vector databases or elaborate knowledge graph | Already implemented | Current PostgreSQL is authoritative; add relational links/search before pgvector. |
| No complex model routing without evaluation benefit | Already implemented | Current simple profile selection fits initial V2. |
| Inngest/Trigger.dev when durable-job needs justify it | Missing | Optional future alternative, not an immediate dependency or required replacement for a small database runner. |
| Avoid an elaborate workflow engine before core lifecycle works | Already implemented | Extend existing tasks/events with the minimum reliable runner and stage contract. |

## 11. V2 definition-of-done cross-check — V2 §18

| Definition-of-done criterion | Classification | Gap IDs |
| --- | --- | --- |
| Retrieve relevant investigation history | Partially implemented | G11, G32, G49–G55 |
| Connect observations and research records | Partially implemented | G10, G23, G72 |
| Reference evidence behind important claims | Partially implemented | G53, G80, G97, G99 |
| Identify missing information and contradictions | Partially implemented | G34–G36, G97–G98 |
| Distinguish known facts from interpretations | Partially implemented | G22, G99–G100 |
| Evidence has provenance | Partially implemented | G67–G69 |
| Findings have traceable supporting records | Implemented but architecturally weak | G71, G80–G81 |
| Human reviewers approve/reject conclusions | Already implemented | G74, G79 |
| AI cannot silently change human decisions | Already implemented | G41, G79, G102; enforce unchanged for future adoption paths |
| Reports present approved conclusions as confirmed | Already implemented | G82; retain report readiness and review gates |
| Supported result formats import and normalize | Missing | G57–G60 |
| Original imported records persist | Missing | G61 |
| Duplicate candidates are reviewable | Partially implemented | G63, G28 |
| Imports associate to the authorized engagement | Missing | G64–G65 |
| Server-side scope checks | Partially implemented | G05, G113; current target gate exists, engagement gate is new |
| Workspace isolation | Implemented but architecturally weak | G112 |
| Private sensitive files | Already implemented | G67; extend handling per G114–G115 |
| Auditable AI tasks | Implemented but architecturally weak | G95, G111 |
| Untrusted imports cannot override system instructions | Partially implemented | G118; cannot claim an absolute guarantee from prompt delimiters |
| AI failures do not corrupt investigations | Partially implemented | G94; current human records are not auto-mutated, but result/task writes can diverge |
| Background jobs retry safely | Missing | G106–G110 |
| Important AI executions inspectable | Partially implemented | G54, G95, G111 |
| Useful without an AI provider | Already implemented | G01; fix misleading mock fallback per G121/G94 |

## 12. Delivery implications and specification reconciliations

V2 §§16 and 20 are fulfilled by this audit package and the ordered plan/backlog, with implementation intentionally deferred for approval. §§1–3 and 19 define the platform direction; G01–G121 map their concrete responsibilities. The five product pillars map to G29–G43 (research intelligence/orchestration), G17–G28/G44–G55 (knowledge), G67–G81/G97–G102 (evidence intelligence), and G02–G16/G56–G89 (assessment workflow).

Resolve these design questions as concrete ADRs during the first approved milestone:

1. Engagement cardinality and Project compatibility: preserve current project/target/investigation identities; define when one project needs several engagements.
2. Investigation analytical phase versus existing status: add phase semantics without relabeling historical completion as vulnerability confirmation.
3. FindingReview/AgentRun naming: extend or link VerificationReview/AITask rather than creating independent decision/status authorities.
4. Report policy: V2 permits a Reporting Agent, while accepted ADR-027 requires reports free of AI-authored content. Retain current deterministic reporting until an explicit replacement policy defines reviewable AI drafts.
5. Submitted versus submit: external status tracking is human-entered bookkeeping; automatic external submission remains prohibited.
6. Confidence and knowledge approval: preserve advisory confidence and separate reviewed source knowledge from AI inference.
7. Scope immutability means immutable approved rules, with audited status/effective-lifecycle metadata; do not prevent legitimate revocation.

The recommended first milestone is **Research Data Foundation with protected V1 invariants**. Complete engagement/decision/relationship and source-provenance foundations, compatibility reads and migration rehearsal before new agent workflows. Bring admission, exact-source validation and queue foundations forward where required by later phases; quality and isolation checks start immediately rather than waiting for Phase 7.
