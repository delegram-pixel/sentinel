# Project checkpoint

Updated: 7 November 2026.

## First-use workspace tour

New accounts now receive a skippable six-step research workflow tour in the dashboard. Skip/Finish/Escape save dismissal against the authenticated user; Settings offers replay. Existing accounts are not automatically enrolled, and legacy/future onboarding versions remain unchanged. A save failure allows retry or closing for the current visit. This reuses existing onboarding fields without a migration or new dependency (ADR-031).

Each tour stage includes an example workflow and expected outcome. Detailed hover/focus/click tooltips cover all navigation sections plus important project, target, scope, investigation, evidence, finding, reporting, and AI fields/sections. Existing inline instructions and authorization gates remain in place.

## V2 implementation checkpoint

The user's instruction to build V2 authorized implementation after the architecture audit. The working tree now includes engagement/scope associations, research decisions, reviewed knowledge/full-text retrieval, persistent AI jobs and execution snapshots, six logical analytical agents, evidence provenance/relationships/recovery, supplied JSON/CSV/SARIF imports, manual remediation/retests/outcomes, AI draft adoption and research insights. Existing V1 models, routes, human approval authority and deterministic report exports remain in use.

See [V2 implementation status](v2/V2_IMPLEMENTATION_STATUS.md) for coverage, acceptance results and explicit remaining work, and [V2 operations](v2/V2_OPERATIONS.md) for migration/backfill/worker instructions. ADR-028–030 supersede the historical V1 exclusions of reviewed AI report drafts and document additive compatibility rules. Production migrations/deployment have not been performed.

V2 verification: TypeScript, lint, Prisma validation, 213 unit tests, 86 PostgreSQL integration tests and the production Webpack build pass. Chromium guest smoke checks pass 10 tests; 3 signed-in checks are skipped without a saved Clerk development session. Default Turbopack execution remains restricted by the environment's CSS-worker port binding. Optional semantic retrieval, live-model quality measurements, restored production-data rehearsal and signed-in workflow acceptance remain outstanding.

The sections below retain the previous V1 checkpoint as historical context. Their old “next work”, test counts and policy descriptions are superseded by the V2 checkpoint and accepted ADRs.

## Current stage

Phase 6 (Evidence and Findings) and the reports module are implemented across the domain,
persistence, application, API, and UI layers, following ADR-004, ADR-005, ADR-008, ADR-013, ADR-015,
ADR-016, ADR-019, ADR-026, and ADR-027. The source documents now record the evidence, quarantine,
storage, upload, report, PDF, and template amendments from ADR-004, ADR-008, ADR-013, ADR-019, and
ADR-027.

Phase 5 (AI Integration) remains complete for the investigation AI workspace:
`TECHNICAL-ARCHITECTURE.md` §20, `AI-ARCHITECTURE.md`, and ADR-025. AI remains advisory and cannot
confirm findings, set severity, change scope, authorize targets, or mark findings reportable. Approved
text evidence is now supplied to AI tasks as untrusted context; binary evidence contributes metadata
only. Reports are human-authored and do not call AI.

The older implementation plan uses different phase numbering; accepted decisions take precedence.

Dashboard is connected at `/dashboard`, Settings at `/dashboard/settings`, and the research slice is
connected at `/dashboard/projects`, `/dashboard/targets`, `/dashboard/investigations`,
`/dashboard/findings`, `/dashboard/evidence`, and `/dashboard/reports`. Each investigation has an AI
workspace at `/dashboard/investigations/[investigationId]/ai`. Reports are live at
`/dashboard/reports`, `/dashboard/reports/new`, and `/dashboard/reports/[reportId]`.

## Latest completed work — Reports

### Report builder

- Reports belong to exactly one investigation and are workspace-scoped. A report can include one or
  more findings, but creation rejects projects or investigations that are archived and findings that
  are not `CONFIRMED` or `REPORTABLE` (ADR-008).
- Only approved evidence (`REDACTED` or `VERIFIED_SAFE`) is retrieved for report snapshots. Pending,
  quarantined, deleted, and unapproved evidence is excluded even when a finding references it.
- Report status follows `DRAFT → UNDER_REVIEW → APPROVED → EXPORTED`, with `ARCHIVED` reachable from
  every non-terminal state and `UNDER_REVIEW → DRAFT` available for revisions.
- Only `OWNER`, `ADMIN`, or `REVIEWER` may approve. Submission and approval both re-run the
  readiness rules: confirmed or reportable status, severity and rationale, affected asset and type,
  impact, remediation, and supporting evidence.
- Creating a report writes revision 1 using a deterministic Markdown renderer with separate summary,
  findings, evidence references, assumptions and limitations, and missing information sections. The
  renderer never calls AI.
- Saving an edit writes an immutable `ReportRevision` with an incremented version and captures the
  finding snapshot plus the evidence ID, title, type, relationship, version, and checksum.
- Reports list across the workspace or by investigation. New-report flow can start from an
  investigation or a confirmed finding, and investigation/finding pages link into it.
- The detail page shows status guidance, report context, current Markdown, included findings,
  evidence references, and the full revision history.
- Export is a Server Action that audits `REPORT_EXPORTED` with the chosen format, moves an approved
  report to `EXPORTED`, and redirects to `GET /api/reports/[reportId]/export` (`?format=pdf` for PDF).
  Markdown and PDF re-downloads are available while the report remains exported. GET never mutates
  report state.
- PDF export is a deterministic server-side Markdown renderer using `pdf-lib` (ADR-027). It supports
  headings, paragraphs, lists, blockquotes, code blocks, A4 pagination, document metadata, and page
  footers. It does not call AI or a browser worker, and Markdown remains canonical.
- Report templates are exposed at `/dashboard/reports/templates`. System templates are seeded by
  migration and read-only; workspace templates are created and activated or deactivated by `OWNER`
  or `ADMIN`. Saving the same name creates the next version.
- Every template must keep summary, findings, evidence references, assumptions, and missing
  information sections. Templates may add methodology and recommendations and control section order.
  Report creation accepts an active system or workspace template, and saved revisions remain immutable
  when a template changes.
- Report mutations write allow-listed audit events: `REPORT_CREATED`, `REPORT_REVISION_SAVED`,
  `REPORT_STATUS_CHANGED`, `REPORT_EXPORTED`, `REPORT_TEMPLATE_CREATED`, and
  `REPORT_TEMPLATE_UPDATED`.
- Unit tests cover status transitions, reviewer roles, readiness, Markdown rendering, template
  schemas, PDF output, validation, and filename generation. Integration tests cover creation,
  revision, submit, reviewer-only approval, Markdown and PDF export, template creation/versioning and
  deactivation, archive, archived-project rejection, readiness regression, and reopening.

### Remaining report gaps

- Reports snapshot approved evidence metadata and the revision content; rendering embedded evidence
  files into the Markdown or PDF export is not implemented.
- PDF rendering is intentionally basic and uses standard PDF fonts, so non-Latin glyph support is
  limited until a font-embedding strategy is adopted.

## Phase 6 — Evidence and findings

### Findings

- Findings belong to one investigation and carry the canonical ADR-005 lifecycle:
  `DRAFT → NEEDS_VALIDATION → UNDER_REVIEW → CONFIRMED | REJECTED | FALSE_POSITIVE → REPORTABLE →
  CLOSED`.
- Only `OWNER`, `ADMIN`, or `REVIEWER` may confirm, reject, false-positive, or mark a finding
  reportable. Researchers may submit for validation and move findings under review.
- Confirmation requires a non-`UNASSESSED` severity, severity rationale, affected asset, affected
  asset type, and at least one `SUPPORTS` evidence link (ADR-016). Reportability additionally
  requires impact, remediation, and an existing human `CONFIRMED` verification review.
- Severity is human-set; the service records the assessor, timestamp, and audit event. AI remains
  advisory.
- Verification reviews are split by reviewer type. AI may record
  `NEEDS_MORE_EVIDENCE`, `NOT_REPRODUCIBLE`, `FALSE_POSITIVE`, or
  `REVIEW_SUPPORTS_CONFIRMATION`; only a human may record `CONFIRMED` or `REJECTED`. The Prisma store
  rejects mismatched reviewer/conclusion combinations (ADR-005).
- Duplicate detection normalizes titles with NFKC, lowercasing, punctuation stripping, and
  whitespace collapsing, then uses PostgreSQL `pg_trgm` similarity at or above 0.55. Candidates are
  advisory, scoped to the investigation and vulnerability category, and limited to the top five.
  A human confirms `duplicateOfId`; the service rejects self-reference and cycles, and confirmation
  transitions the finding to `REJECTED` with `resolutionReason = DUPLICATE` (ADR-015).
- Findings list across the workspace or by investigation, and each finding has create, detail, and
  edit pages. The edit page is limited to `DRAFT` and `NEEDS_VALIDATION`.
- Every finding page and Server Action re-resolves `getSessionContext()`, scopes queries to the
  authenticated workspace, and treats foreign findings as absent.
- Finding mutations write allow-listed audit events in the same transaction as the change.

### Evidence

- Evidence belongs to one investigation and is workspace-scoped. It links to findings only through
  `EvidenceLink` with `SUPPORTS`, `CONTRADICTS`, `CONTEXT`, or `REPRODUCTION`.
- Upload uses the direct-upload flow from ADR-004, ADR-013, and ADR-019:
  1. `POST /api/evidence/upload-intent` validates authentication, workspace access, investigation
     state, MIME type, size, and the declared checksum, creates a quarantined record, and returns an
     UploadThing intent. The local development fallback returns a five-minute presigned PUT URL.
  2. The browser uploads through the authenticated `evidenceUploader` UploadThing FileRouter route.
  3. `POST /api/evidence/[evidenceId]/finalize` downloads the private object, verifies size, SHA-256
     checksum, and magic bytes, runs the advisory sensitive-data scan, and marks the record
     `NOT_REVIEWED` or `QUARANTINED`.
- Files are limited to 25 MB. The MIME allowlist covers PNG, JPEG, WebP, PDF, text, CSV, JSON, XML,
  and NDJSON; HTML and SVG are rejected. Declared and detected types must be compatible.
- Text evidence supports client-side editing before upload, and the upload form computes the SHA-256
  checksum in the browser. The UI states that client-side redaction cannot be independently
  guaranteed.
- Only a human reviewer may resolve redaction. Approval without change records `VERIFIED_SAFE`;
  approval of a sanitized replacement records `REDACTED`; rejection deletes the private object
  and requires a replacement.
- Activation happens in place: the private UploadThing object is kept, `storageKey` is set, and
  `quarantineKey` is cleared. The server re-verifies the checksum, records the reviewer and
  timestamp, and never copies or renames the object. Active evidence cannot be reviewed or
  overwritten again.
- Only `REDACTED` or `VERIFIED_SAFE` evidence may link to a finding or enter AI context. Pending and
  quarantined evidence is visible only to its uploader, the workspace owner, and reviewers.
- Downloads require a server-side authorization check and redirect to a short-lived signed URL.
  Quarantine downloads are restricted to the uploader and reviewers.
- Deletion is soft and blocked while the evidence is linked to a finding. Both active and quarantine
  objects are removed from storage.
- The storage adapter is an interface with an UploadThing adapter for production and a local
  filesystem adapter for development when `UPLOADTHING_TOKEN` is absent. The local adapter uses
  HMAC-signed development-only routes at `/api/evidence/local-upload` and
  `/api/evidence/local-download`.
- Evidence and findings appear in investigation details and on their own list, detail, upload, and
  edit pages. The dashboard shows the five most recent evidence records with investigation, redaction
  status, and a link to the evidence library. Relationship and metadata forms are Server Actions; only
  upload intent, finalize, download, and the UploadThing FileRouter are Route Handlers (ADR-009).
- Every evidence page and Server Action re-resolves `getSessionContext()` and treats foreign
  evidence as absent. Evidence mutations write allow-listed audit events.

### Schema and infrastructure

- The Prisma schema includes `Evidence` with quarantine/active keys, checksum, advisory scan
  results, redaction method, reviewer, activation, version, supersede, and soft-delete fields.
- `Evidence.fileName` was added by migration `20261106220000_evidence_file_name`.
- UploadThing provides private evidence storage; the AWS SDK is no longer a dependency.
- `.data/` is gitignored for the local evidence adapter.
- Unit tests cover finding title normalization, confirmation/reportability readiness, severity
  validation, evidence MIME detection, intent validation, redaction policy, storage keys, and the
  advisory scanner.
- Integration tests cover the finding lifecycle, human-only confirmation, duplicate detection and
  cycle prevention, evidence upload/finalize/review/link/delete, flagged-content quarantine, and
  checksum rejection.

## UI polish — Editorial Research Console

- The user confirmed continuing overall UI polish under ADR-026.
- Shared page headings and action groups wrap according to the available width, keeping tablet
  headings readable when several actions are present.
- Long breadcrumbs retain the current section and record with a full-path drawer for parent
  navigation. The drawer uses the installed Radix Sheet, including Escape and focus restoration.
- Overflowing record tables keep the first record column visible, show a scrolling hint and
  left/right controls, preserve native keyboard scrolling, and respect reduced motion. Controls
  disappear when all columns fit; record content remains server-rendered.
- Isolated Playwright checks passed at 1440, 820, 390, and 320 pixels wide, with an additional
  1600-pixel resize check. They exercised parent navigation, drawer focus restoration, scroll limits,
  pinned record names, keyboard scrolling, and reduced motion without client runtime errors or
  document overflow. The preview used actual shared components and project fonts, with no persisted
  research records or authentication changes.
- Lint, TypeScript, 180 unit tests, the production build, and the four guest Playwright tests passed.
  The three authenticated tests remain skipped without a saved Clerk login; the isolated preview is
  not a substitute for signed-in route and data-flow verification.

## Earlier completed work

- Phase 5 AI: guided chat, reconnaissance analysis, hypothesis generation, AI session summaries,
  Anthropic tool use with Zod re-validation and one corrective retry, versioned hashed prompts,
  context compression, per-task budgets, a rolling 24-hour 250,000-token user cap, SSE chat, and a
  deterministic mock provider. Archived investigations reject new AI tasks.
- AI context now includes approved evidence (`REDACTED` or `VERIFIED_SAFE`). Text-like evidence up
  to 512 KB is read through `EvidenceStorage`, bounded per task, and labelled as untrusted data.
  Binary evidence contributes metadata only, storage failures degrade to metadata, and each task
  records the included evidence IDs and versions in `inputContext` and its context event.
- Phase 4 investigations: lifecycle, observations, hypotheses and links, manual summaries, audits,
  and project-scoped lists.
- Phase 3 projects, targets, and scope management, including self-attested activation, revocation,
  and the action-time scope validator.
- Phase 2 data, authentication, dashboard, settings, workspace provisioning, membership, and audit
  history.
- ADR-026's Editorial Research Console visual system is used across the research pages.

## Next implementation work

1. Complete the end-to-end AI verification assistant: run a verification task against a finding,
   persist the AI review with its split vocabulary, and show it beside the human review.
2. Expose evidence supersession so a correction creates a new `version` with `supersedesId` instead
   of requiring a fresh unlinked record (ADR-004).
3. Apply the remaining source-document amendments for ADR-024, ADR-025, and earlier ADRs when those
   documents are next revised.

## Open decisions and known gaps

- **M-05 retention:** soft-delete retention, hard-delete job, account deletion, and audit retention
  remain undecided.
- **M-30 malware scanning:** deferred for the MVP. Compensating controls are the MIME allowlist,
  magic-byte validation, size limits, private storage, signed downloads, quarantine, and a human
  review. This must be revisited before public or multi-tenant launch.
- **M-38 region and data residency:** the Neon/Vercel region is recorded at deployment and remains
  subject to this decision.
- **Image redaction UI:** text evidence can be edited before upload, but the image masking/blackout
  step described in ADR-013 §3 is not implemented yet. Server checks and human review remain
  mandatory.
- **Evidence versioning UI:** the schema and keys support versions, but the creation flow for a
  superseding version is not exposed yet.
- **Onboarding:** deferred under ADR-023. First authenticated access provisions the workspace.
- **Background Clerk synchronization:** requires a configured signing secret; the lazy
  `getSessionContext()` fallback covers missed webhooks.

## Verification

- `yarn typecheck` passes.
- `yarn lint` passes.
- 188 unit tests pass across 24 files.
- 67 PostgreSQL integration tests pass across 11 files against the disposable local `sentinel_test`
  database, including the Phase 6 finding and evidence suites, the reports suite, and AI evidence
  context. The test database is migrated with `prisma migrate deploy`; integration tests never use
  Neon.
- `yarn build` passes with the default Turbopack compiler, Cache Components, and partial
  prefetching. All Phase 6 and report routes are present, including
  `/dashboard/reports/templates` and `/api/reports/[reportId]/export` for Markdown and PDF.
- The browser suite passes: 4 guest checks run and 3 authenticated checks are skipped without
  `CLERK_E2E_STORAGE_STATE`.
- Integration tests alias the `server-only` marker to an empty module because they run outside a
  React Server Component environment; production builds still enforce the boundary.

The `sentinel-pg` local PostgreSQL container is running for integration verification. No Git commits
exist yet; this checkpoint records the current working files.
