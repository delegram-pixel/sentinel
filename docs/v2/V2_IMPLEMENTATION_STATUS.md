# Sentinel Research V2 implementation checkpoint

Updated: 2026-11-07. Implementation authority: the user's subsequent instruction, **“build v2”**. The four architecture audit documents remain the historical V1 baseline. This checkpoint describes the implemented working tree against `technical-architecture-2.md` and ADR-028–030.

## Delivered behavior

| Area | Implementation and existing components retained |
| --- | --- |
| Engagements | Project-owned engagements, objectives/dates/status, existing target associations and references to immutable ScopeVersion records. New `/dashboard/engagements` screens retain V1 project/target URLs. Engagement status does not grant authorization. |
| Research history | Research phases supplement existing investigation status. Attributable decisions and investigation relationships preserve rejected hypotheses, source references and human rationale. Existing observations, hypotheses and summaries remain authoritative records. |
| Knowledge | Supplied sources, publication/retrieval dates, source URLs, immutable documents, review/withdrawal and typed document relationships. Reviewed documents receive versioned chunks with offsets/checksums. PostgreSQL exact/full-text retrieval filters workspace, engagement, investigation and review state before ranking and records retrieval provenance. |
| AI context | Bounded reads, decisions, findings/reviews, relevant history, reviewed references and session-aware summaries extend the existing Context Manager. Immutable snapshots retain the actual provider request, prompt version/hash, truncation and exact selected source manifest. Citations to omitted or foreign sources fail validation. |
| AI execution | Existing AITask/AITaskEvent identities remain the run and event record. Each provider/correction request has an AIExecutionAttempt. Stable operation keys, atomic token reservations and atomic result/message/summary completion protect replay and budget accounting. Captured responses can recover without another provider call. |
| Durable work | A PostgreSQL queue in the same monolith supports atomic claims, expiring leases, heartbeats, bounded retries, cancellation and stale-worker fencing. Explicit rate-limit responses retry with separately attributable parent-linked runs. Unknown provider execution retains an uncertain reservation and requires administrator reconciliation rather than blind resubmission. |
| Analytical agents | Six logical responsibilities use task-specific prompts/contracts: context, patterns, hypotheses, evidence, independent verification and reporting. Guided/delegated session mode is persisted. User-requested context/pattern/hypothesis and evidence/verification sequences retain separate task outputs. Human adoption creates labelled observations or draft hypotheses with source decisions. |
| Evidence | Validated uploads, human approval, collection provenance, observation/hypothesis relationships, source-linked AI assessments and reviewed replacement chains extend existing evidence/storage adapters. Recorded promotion/cleanup jobs recover object-store failures. Original versions and evidence referenced by reviews, decisions, reports, retests or AI snapshots are retained. Approved evidence is visible to workspace researchers; quarantine is restricted. |
| Findings | Existing finding and human VerificationReview authority is retained. One evidence-link mutation implementation protects the last supporting evidence. Expected-state guards protect consequential review/status writes. More-research and closure require attributable human decisions. AI verification uses the advisory vocabulary and cannot confirm findings. |
| Tool imports | Bounded supplied JSON, CSV and SARIF 2.1.0 exports are processed through durable jobs. Raw content/records, hashes, parser/mapping versions, canonical fields and explicit duplicate reasons are preserved. Reviewed adoption creates observations or unassessed draft findings after server-side asset/investigation checks. |
| Remediation | Remediation plans, progress, documented manual retest requests against exact engagement asset/scope versions, supplied results, approved evidence and human closure. Expired/revoked/excluded scope blocks new retest requests. |
| Reporting | Existing deterministic templates, Markdown, immutable revisions and PDF exports remain available. New bug-bounty/formal-audit templates use the same renderer. Explicitly adopted AI drafts carry source-task/model/prompt provenance, then human edits/review/approval. New snapshots retain each finding/evidence/relationship association. First export is audited; downloads do not submit reports. |
| Product integration | Knowledge, tool imports, remediation/outcomes, background work and research insights appear in existing navigation. Task status is authenticated and not cached. Sidebar/breadcrumb URL hooks and new detail-route parameter reads have the required Suspense boundaries for Next.js Cache Components. |

## Compatibility and persistence

Seven additive migrations extend the original schema; existing migrations are unchanged. Original UUIDs, scope/approval states, human/AI author types, investigation status, report content and evidence objects are retained. New SQL constraints enforce parent/tenant consistency, upload-validation and immutable snapshot/assessment basis. Legacy approved evidence remains readable without inventing upload-validation or collection history.

The operator backfill is idempotent and processes project batches with a resumable cursor. It creates draft legacy engagements, associates original targets/scopes/investigations and copies identified human summaries into attributable research notes. It does not approve an engagement, change scope validity, confirm a finding or invent missing AI context. Very large individual projects still require a scale rehearsal; the project batch bound is not a bound on every nested legacy relation.

The preservation test recreates V1 tables in a disposable PostgreSQL schema, captures original columns/UUIDs/row hashes/index definitions, applies every V2 migration, and compares each original projection after every migration. This is executable fixture evidence, not a production-data restoration rehearsal or a physical object-store inventory.

## Backlog coverage

| Audit tickets | Current status |
| --- | --- |
| B00 | Audit package delivered. |
| B01, B03–B08 | Core implementation delivered; compatibility decisions recorded in ADR-028–030. |
| B02, B09 | Preservation/backfill/isolation fixtures delivered; restored production inventory and authenticated UI acceptance remain operator/environment work. |
| B10–B17, B19 | Context, source capture, admission, completion, runner, task UI and exact/full-text knowledge engine delivered. Production worker provisioning and load measurement remain deployment work. |
| B18 | Optional pgvector embeddings and hybrid semantic retrieval are outstanding. No embedding provider, vector extension or separate vector database is configured. |
| B20 | Versioned deterministic contract/quality scenarios delivered in `evaluations/DATASET.md`; researcher-reviewed live-model measurements are outstanding. |
| B21–B24 | Logical agent contracts, staged analysis, reviewable adoption, evidence assessments and independent AI verification delivered. These are bounded analytical workflows, not a generic workflow language. |
| B25–B34 | Evidence provenance/recovery/relationships, generic import formats/review, richer human decisions, manual remediation/outcomes, report snapshot integrity and adopted reporting drafts delivered. Named vendor adapters and advanced evidence rendering remain separate work. |
| B35 | Live-model citation/unsupported-claim/false-positive/reviewer-agreement measurements and approved release thresholds are outstanding. |
| B36 | Engineering recovery/isolation/migration/scope tests delivered; signed-in full workflows, concurrent multi-worker load and production-scale query/storage acceptance remain outstanding. |

This is a working V2 core with explicit acceptance gaps, not a claim that every optional architecture capability or production gate is complete.

## Verification

The complete unit suite passed 213 tests across 28 files, and the final PostgreSQL integration suite passed 86 tests across 18 files. TypeScript, lint, Prisma schema validation and formatting checks passed. Navigation unit tests were rerun after the shell changes and passed. Worker/backfill modules load through the CLI TypeScript loader without opening the application database. The production Webpack build passed with all V2 routes. Chromium browser smoke checks passed 10 tests; 3 authenticated tests were skipped without a saved Clerk session.

Integration verification uses only the disposable local `sentinel_test` database. Recovery cases include captured-result replay, uncertain usage reconciliation, in-flight cancellation, stale leases/retry exhaustion, rate-limit retry attribution, promotion cancellation, failed object copy, failed cleanup, reviewed version retention and historical human verification references.

Browser availability: Browser plugin not available; the existing Playwright workflow is used. Flow: landing page → workspace link → authentication boundary; direct V2 routes → authentication boundary; sign-in/sign-up → meaningful auth UI without client exceptions. Signed-in tests require `CLERK_E2E_STORAGE_STATE` and are skipped when it is absent. Guest checks do not prove signed-in adoption, upload or remediation interactions, or desktop/mobile visual fidelity.

The default Turbopack build encountered an environment-level CSS-worker port-binding restriction, including after escalation. The combined build/browser command also exceeded its 180-second startup allowance in this environment. Final verification used `yarn build --webpack`, followed by the unchanged browser suite using a temporary `/tmp/sentinel-v2-playwright.config.ts` that starts the already-built server from the project directory. Browser URL: `http://localhost:3100`; Chromium Desktop Chrome configuration. Test output was stored under `/tmp/sentinel-v2-browser-results`. Screenshots and signed-in desktop/mobile visual fidelity were not evaluated. No dependency was installed to work around the build restriction.

## Remaining acceptance and optional work

- Run signed-in investigation → analysis → human adoption → finding review → approved report export and approved replacement evidence flows using disposable records. Check desktop/mobile navigation and keyboard behavior after the Suspense changes.
- Rehearse migration/backfill against a restored real V1 dataset and private object inventory; reconcile old IDs, approvals, Markdown hashes, checksums and custom SQL before production deployment.
- Configure and supervise the worker with the same database/storage configuration as the web application. Measure competing claims, heartbeat recovery, queue delay and slow storage behavior under realistic load.
- Add an explicitly selected embedding provider and optional pgvector/hybrid ranking, with provenance and measured retrieval fixtures. Exact/full-text retrieval already works independently.
- Run researcher-reviewed synthetic/public live-model evaluations. Deterministic schema/source checks cannot establish factual correctness, calibrated confidence or human agreement.
- Add named tool-export adapters only with documented format compatibility fixtures. Generic JSON/CSV/SARIF support does not promise Nmap/ZAP/Burp compatibility.
- Retain earlier documented gaps for malware scanning, image redaction tools, account/audit retention policy, embedded evidence rendering and non-Latin PDF fonts until those requirements are implemented.

See [V2 operations](V2_OPERATIONS.md) for migration, worker and recovery commands. Production migration/deployment has not been performed by this implementation task.
