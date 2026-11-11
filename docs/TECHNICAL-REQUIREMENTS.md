# SENTINEL RESEARCH
# Technical Requirements Document (TRD)

**Version:** 1.0  
**Status:** Initial Technical Specification

---

## 1. Technical Overview

Sentinel Research will be developed as a modular, full-stack web application.

The architecture will separate:
- User interface.
- Business logic.
- AI orchestration.
- Investigation management.
- Evidence processing.
- Data persistence.
- Background processing.

The initial release will use a modular monolith rather than microservices.

This reduces infrastructure complexity while allowing individual modules to evolve independently.

---

## 2. Technology Stack

### Frontend

| Technology | Responsibility |
|---|---|
| Next.js App Router | Application framework |
| React | Component architecture |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | UI components |
| Lucide React | Icons |
| Motion | UI animations |
| React Hook Form | Form management |
| Zod | Validation |

### Backend

| Technology | Responsibility |
|---|---|
| Next.js Route Handlers | HTTP API |
| Server Actions | Application mutations |
| Prisma ORM | Database access |
| PostgreSQL | Primary database |
| Zod | Request validation |
| Background job system | Long-running tasks |

### Authentication

Initial recommendation:
- Clerk for authentication.
- Server-side identity verification.
- Application-level authorization.
- Role-based access controls.

### AI Infrastructure

Initial provider:
- Anthropic Claude API.

Requirements:
- Provider abstraction.
- Structured AI responses.
- Context management.
- Token usage tracking.
- Request timeouts.
- Retry handling.
- AI task logging.
- Model configuration.

### File Storage

Use private UploadThing storage for evidence files (ADR-019). The UploadThing app uses the private
ACL; there is no public access and no public object URL.

Store:
- Screenshots.
- Evidence attachments.
- Exported reports.
- Supporting documents.

Store file metadata in PostgreSQL. Never store raw evidence bodies in the database.

Evidence files are limited to 25 MB and authorization artifacts to 10 MB. Browser uploads go
directly through the authenticated `evidenceUploader` FileRouter route; signed GET URLs
URLs expire after five minutes. The MIME allowlist is `image/png`, `image/jpeg`, `image/webp`,
`application/pdf`, `text/plain`, `text/csv`, `application/json`, `application/xml`, `text/xml`, and
`application/x-ndjson`; HTML and SVG are rejected. The server sniffs magic bytes on finalize and
rejects a mismatch between the declared and detected type.

Evidence uploads are quarantined first by record state. A human reviewer must resolve redaction before
the private object is activated in place and becomes eligible for finding links, AI context, or report
export (ADR-013). Approval does not copy or rename the UploadThing object.

### Development Tools

- Git and GitHub.
- ESLint.
- Prettier.
- Vitest.
- Playwright.
- Prisma migrations.

**Package manager:** Yarn.

---

## 3. Application Architecture

### 3.1 Architectural Pattern

Modular monolith.

The application will contain independently organized domain modules sharing one deployment and database.

Primary modules:

1. Authentication.
2. Users.
3. Workspaces.
4. Projects.
5. Targets.
6. Scope.
7. Investigations.
8. Findings.
9. Evidence.
10. AI orchestration.
11. Verification.
12. Reports.
13. Audit logs.

### 3.2 High-Level Architecture

User Interface
    |
    v
Next.js Application
    |
    +-- Authentication and Authorization
    |
    +-- Project Management
    |
    +-- Target and Scope Management
    |
    +-- Investigation Engine
    |
    +-- Finding Management
    |
    +-- Evidence Management
    |
    +-- AI Orchestration
    |       |
    |       +-- Claude Provider
    |       +-- Research Assistant
    |       +-- Verification Assistant
    |       +-- Reporting Assistant
    |
    +-- Report Generation
    |
    v
PostgreSQL Database

External Services:
- AI provider.
- Object storage.
- Background processing service.
- Authentication provider.

---

## 4. Application Routing

### Public Routes

- `/`
- `/features`
- `/pricing`
- `/documentation`
- `/sign-in`
- `/sign-up`

### Protected Routes

- `/dashboard`
- `/dashboard/projects`
- `/dashboard/projects/new`
- `/dashboard/projects/[projectId]`
- `/dashboard/projects/[projectId]/targets`
- `/dashboard/projects/[projectId]/investigations`
- `/dashboard/investigations/[investigationId]`
- `/dashboard/investigations/[investigationId]/workspace`
- `/dashboard/investigations/[investigationId]/findings`
- `/dashboard/findings/[findingId]`
- `/dashboard/evidence`
- `/dashboard/reports`
- `/dashboard/reports/[reportId]`
- `/dashboard/settings`

### Navigation Groups

**Workspace**
- Overview
- Projects
- Investigations

**Research**
- Targets
- Findings
- Evidence
- Reports

**Account**
- Settings
- AI configuration

---

## 5. Backend Module Requirements

### 5.1 Authentication Module

Responsibilities:
- Authentication integration.
- User identity synchronization.
- Session validation.
- Protected route enforcement.
- Account lifecycle management.

Requirements:
- Every protected request must validate identity.
- Users must only access authorized records.
- Authentication must not be confused with application authorization.

### 5.2 Project Module

Responsibilities:
- Project creation.
- Project retrieval.
- Project updates.
- Project archival.
- Project ownership.

### 5.3 Target and Scope Module

Responsibilities:
- Target registration.
- Scope documentation.
- Scope versioning.
- Exclusion management.
- Authorization status.

Requirements:
- Store scope as structured records.
- Maintain scope change history.
- Require explicit approval before enabling any permitted testing integration.
- Treat missing or expired authorization as a block.

### 5.4 Investigation Module

Responsibilities:
- Investigation lifecycle.
- Hypothesis records.
- Observations.
- Session summaries.
- Investigation history.
- Next-action tracking.

Requirements:
- Every investigation must belong to a project.
- Every investigation must reference an authorized learning environment or target.
- Completed actions must be recorded.
- Investigations must be resumable.

### 5.5 Finding Module

Responsibilities:
- Finding creation.
- Finding categorization.
- Status tracking.
- Duplicate detection.
- Verification linkage.
- Report linkage.

### 5.6 Evidence Module

Responsibilities:
- Evidence upload.
- Metadata management.
- Secure retrieval.
- File validation.
- Redaction status.
- Evidence-to-finding relationships.

### 5.7 AI Module

Responsibilities:
- AI provider communication.
- Prompt management.
- Context assembly.
- Task orchestration.
- Response validation.
- Usage tracking.
- Failure handling.

All AI responses that change application state must pass server-side validation.

### 5.8 Report Module

Responsibilities:
- Investigation-scoped report creation.
- Report templates, versioned with system or workspace scope.
- Selection and ordering of confirmed or reportable findings.
- Approved evidence references only.
- Immutable revision history with finding and evidence snapshots.
- Human approval before export.
- Markdown and PDF export and report archiving.
- Markdown is canonical; PDF is a deterministic server-side derived export (ADR-027).
- System templates are seeded read-only; workspace templates are owner/administrator-managed,
  versioned by name, and cannot remove the required report sections.
- Revision history and status auditing.

---

## 6. AI Integration Requirements

### Provider Abstraction

Create a common AI provider interface.

Conceptual contract:

- generateResponse()
- generateStructuredResponse()
- estimateUsage()
- getProviderStatus()

The application must not depend directly on Anthropic-specific response structures throughout the business logic.

### AI Task Types

- RECON_ANALYSIS
- ATTACK_SURFACE_ANALYSIS
- HYPOTHESIS_GENERATION
- EVIDENCE_REVIEW
- FALSE_POSITIVE_REVIEW
- FINDING_SUMMARY
- REPORT_GENERATION
- SESSION_SUMMARY

### Structured Responses

Every specialized assistant must return validated structured data.

Example:

{
  "taskType": "EVIDENCE_REVIEW",
  "status": "completed",
  "conclusion": "NEEDS_MORE_EVIDENCE",
  "summary": "The available observations do not establish the claimed security impact.",
  "supportingEvidence": [],
  "contradictingEvidence": [],
  "missingEvidence": [],
  "recommendedNextAction": "Review the expected application behaviour."
}

This is a data contract example, not a fixed AI conclusion.

### AI Limitations

- AI cannot establish authorization.
- AI cannot independently approve scope changes.
- AI cannot mark findings as reportable without human review.
- AI cannot access arbitrary external resources.
- AI must not fabricate evidence.
- AI-generated confidence must remain advisory.
- User-provided evidence must be treated as untrusted input.

---

## 7. API Requirements

Initial API domains:

### Projects
- GET `/api/projects`
- POST `/api/projects`
- GET `/api/projects/[id]`
- PATCH `/api/projects/[id]`
- DELETE `/api/projects/[id]`

### Targets
- GET `/api/projects/[id]/targets`
- POST `/api/projects/[id]/targets`

### Investigations
- GET `/api/investigations`
- POST `/api/investigations`
- GET `/api/investigations/[id]`
- PATCH `/api/investigations/[id]`

### Findings
- GET `/api/findings`
- POST `/api/findings`
- GET `/api/findings/[id]`
- PATCH `/api/findings/[id]`

### Evidence
- POST `/api/evidence/upload-intent`
- POST `/api/evidence/[evidenceId]/finalize`
- GET `/api/evidence/[evidenceId]/download`
- POST `/api/uploadthing` (UploadThing FileRouter)

The evidence endpoints implement the direct-upload flow (ADR-004, ADR-013, ADR-019):

1. `upload-intent` validates authentication, workspace access, scope, MIME type, size, and the
   declared checksum, creates a quarantined evidence record, and returns `{ kind: "UPLOADTHING" }`.
   The local development fallback returns a short-lived presigned PUT URL instead.
2. The client uploads directly through the authenticated UploadThing FileRouter, then calls
   `finalize`. The FileRouter enforces ownership, the MIME allowlist, a single file, and the size
   limit. `finalize` verifies the object size, SHA-256 checksum, and magic bytes, runs the advisory
   sensitive-data scan, and marks the record `NOT_REVIEWED` or `QUARANTINED`. The object is not
   active yet.
3. A human reviewer resolves redaction through a Server Action. Approval activates the private
   object **in place** (sets `storageKey`, clears `quarantineKey`), re-verifies the checksum, and
   records the reviewer; there is no copy or rename. Rejection deletes the private object.
4. `download` performs a server-side authorization check and redirects to a short-lived signed URL.

Evidence metadata updates, redaction review, link management, and soft deletion are Server Actions,
not REST endpoints (ADR-009). Signed download URLs expire after five minutes. Evidence files
are limited to 25 MB; the MIME allowlist is `image/png`, `image/jpeg`, `image/webp`,
`application/pdf`, `text/plain`, `text/csv`, `application/json`, `application/xml`, `text/xml`, and
`application/x-ndjson`. Anything else is rejected at upload intent and by the FileRouter, and finalize
rejects a mismatch
between the declared and detected type.

### AI
- POST `/api/ai/tasks`
- GET `/api/ai/tasks/[id]`
- POST `/api/ai/reviews`
- GET `/api/ai/conversations/[id]`

### Reports
- GET `/api/reports`
- POST `/api/reports`
- GET `/api/reports/[id]`
- GET `/api/reports/[id]/export`

All endpoints require server-side authorization, schema validation, rate limiting where appropriate and audit logging.

---

## 8. Database Requirements

PostgreSQL will be the primary database.

Requirements:
- Relational data model.
- UUID primary keys.
- Created and updated timestamps.
- Foreign-key relationships.
- Indexed lookup fields.
- Soft deletion where appropriate.
- Referential integrity.
- Transactional mutations.

Prisma will manage database access and migrations.

---

## 9. Security Requirements

### Authentication and Authorization
- Verify identity server-side.
- Enforce record ownership.
- Implement workspace isolation.
- Apply least-privilege access.

### AI Security
- Protect provider credentials.
- Prevent prompt injection from evidence and uploaded files.
- Validate AI tool permissions.
- Restrict external actions.
- Enforce task budgets.

### Evidence Security
- Validate file types in the FileRouter and on finalize.
- Limit upload size.
- Use private UploadThing storage with the private ACL.
- Generate short-lived download links.
- Redact sensitive data.
- Avoid storing unnecessary personal information.

### Application Security
- CSRF protection where applicable.
- XSS protection.
- Input validation.
- Rate limiting.
- Secure HTTP headers.
- Audit trails.
- Dependency monitoring.

### Testing Safety
- No unrestricted target scanning.
- No autonomous exploitation.
- No testing outside documented scope.
- No access to unrelated users' data.

---

## 10. Background Processing

AI tasks may take longer than ordinary web requests.

Use a background job system when asynchronous workloads are introduced.

Job lifecycle:

PENDING
RUNNING
COMPLETED
FAILED
CANCELLED

Requirements:
- Retry policies.
- Timeout management.
- Idempotency.
- Progress tracking.
- Cancellation.
- Failure logging.

Do not introduce Redis or a separate job service until actual workload requirements justify it.

---

## 11. Testing Requirements

### Unit Tests
- Business logic.
- Validation.
- Status transitions.
- Scope enforcement.
- AI response parsing.

### Integration Tests
- Database operations.
- Authentication.
- Authorization.
- Project relationships.
- Evidence management.
- AI provider abstraction.

### End-to-End Tests
- Registration.
- Project creation.
- Target registration.
- Investigation creation.
- Evidence attachment.
- Verification review.
- Report generation.

### Security Tests
- Cross-user access prevention.
- Unauthorized API requests.
- File upload validation.
- Prompt injection resistance.
- Scope enforcement.
- Secret exposure checks.

---

## 12. Deployment Requirements

Initial deployment:

- Next.js hosting platform.
- Managed PostgreSQL.
- Managed authentication.
- Private UploadThing evidence storage.
- AI provider API.

Environments:
- Development.
- Staging.
- Production.

Requirements:
- Environment-specific secrets.
- Database backups.
- Error monitoring.
- Request logging.
- Usage monitoring.
- Migration management.

---

## 13. Technical Acceptance Criteria

The technical MVP is complete when:

1. Application modules are separated by responsibility.
2. Authentication and authorization work correctly.
3. Users cannot access other users' projects.
4. Scope restrictions are enforced server-side.
5. Investigations persist correctly.
6. AI responses follow validated schemas.
7. Evidence files are securely stored.
8. Verification history is retained.
9. Reports reference their underlying evidence.
10. Automated tests cover critical workflows.
11. Provider credentials remain server-side.
12. Interrupted AI tasks can be recovered or marked failed.