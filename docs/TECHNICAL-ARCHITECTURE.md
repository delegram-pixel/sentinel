# SENTINEL RESEARCH
# Technical Architecture & Project Blueprint

**Document:** Technical Architecture & Project Blueprint  
**Project:** Sentinel Research  
**Version:** 1.0  
**Status:** Development Blueprint  
**Architecture Style:** Modular Monolith  
**Package Manager:** Yarn  
**Frontend:** Next.js + TypeScript  
**Database:** PostgreSQL + Prisma ORM  
**Initial AI Provider:** Anthropic Claude

---

# 1. Technical Overview

## 1.1 Project Description

Sentinel Research is an AI-assisted security research and bug bounty management platform designed to help security researchers organize investigations, manage evidence, evaluate potential vulnerabilities, and generate structured security reports.

The platform combines guided research workflows with delegated AI-assisted tasks.

Its architecture must prioritize:

- Evidence-backed research.
- Persistent investigation context.
- Accurate AI-generated analysis.
- False-positive reduction.
- Secure evidence storage.
- Authorization and scope enforcement.
- Human approval before findings are confirmed.
- Maintainable and scalable application architecture.

## 1.2 Architectural Approach

Sentinel Research will use a **Modular Monolith Architecture**.

The application will initially operate as one Next.js application with clearly separated business modules.

Each module will own its business logic, validation, database operations, and service functions.

This approach provides:

- Easier development and debugging.
- Less infrastructure complexity.
- Shared authentication and authorization.
- Centralized database management.
- Clear separation of responsibilities.
- The option to extract services later if necessary.

Microservices will not be introduced during the initial development phase.

---

# 2. Technology Stack

## 2.1 Core Technologies

| Layer | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| UI Components | shadcn/ui |
| Icons | Lucide React |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Auth.js or Clerk |
| AI Provider | Anthropic Claude API |
| AI SDK | Official Anthropic SDK |
| Validation | Zod |
| Forms | React Hook Form |
| Server State | TanStack Query where needed |
| Client State | Zustand where needed |
| File Storage | S3-compatible private object storage |
| Notifications | Sonner |
| Charts | Recharts |
| Testing | Vitest and Playwright |
| Package Manager | Yarn |
| Deployment | Vercel or another compatible hosting platform |

## 2.2 Technology Decisions

### Next.js

Use the App Router for:

- Application routing.
- Server Components.
- Server Actions.
- API endpoints.
- Authentication-related server operations.
- Server-side data fetching.

### TypeScript

Enable strict TypeScript configuration.

Avoid unnecessary use of `any`.

Use shared types for:

- Database entities.
- API responses.
- AI task inputs and outputs.
- Investigation states.
- Finding statuses.
- Evidence metadata.

### PostgreSQL

PostgreSQL will be the primary relational database.

It will store:

- Users and workspaces.
- Projects and targets.
- Scope records.
- Investigations.
- Observations and hypotheses.
- Findings.
- Evidence metadata.
- AI conversations and tasks.
- Verification reviews.
- Reports.
- Audit records.

### Prisma

Prisma will handle:

- Database models.
- Queries.
- Relations.
- Migrations.
- Type-safe database access.

All database operations should go through module-level repository or service functions rather than being scattered across UI components.

---

# 3. High-Level System Architecture

The application will be divided into five primary layers.

## 3.1 Presentation Layer

Responsible for the user interface.

Responsibilities:

- Dashboard rendering.
- Project management screens.
- Investigation workspace.
- AI workspace.
- Findings management.
- Evidence library.
- Report editor.
- Settings and account management.

Location:

`src/components/`

`src/app/`

## 3.2 Application Layer

Responsible for coordinating user actions and business workflows.

Examples:

- Creating an investigation.
- Registering a target.
- Updating scope information.
- Creating an AI task.
- Submitting a finding for review.
- Generating a report.

Location:

`src/modules/`

## 3.3 Domain Layer

Contains the business rules and core application logic.

Examples:

- Target authorization rules.
- Scope validation.
- Finding status transitions.
- Evidence requirements.
- Investigation lifecycle.
- AI task lifecycle.

Domain rules must not depend on React components.

## 3.4 Infrastructure Layer

Responsible for external integrations.

Examples:

- PostgreSQL.
- Prisma.
- Anthropic API.
- Object storage.
- Authentication provider.
- Logging.
- Email notifications.

Location:

`src/lib/`

`src/modules/*/infrastructure/`

## 3.5 External Services

The application may communicate with:

- Anthropic Claude API.
- PostgreSQL hosting.
- Private object storage.
- Authentication provider.
- Email provider.

External services must be accessed through server-side integrations.

Never expose private API credentials to the browser.

---

# 4. Recommended Project Structure

Use the following folder structure:

```text
sentinel-research/
│
├── docs/
│   ├── PRD.md
│   ├── TECHNICAL-REQUIREMENTS.md
│   ├── APP-FLOW.md
│   ├── DESIGN-BRIEF.md
│   ├── DATABASE-SCHEMA.md
│   ├── AI-ARCHITECTURE.md
│   ├── IMPLEMENTATION-PLAN.md
│   └── TECHNICAL-ARCHITECTURE.md
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│
├── src/
│   │
│   ├── app/
│   │   ├── (marketing)/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── projects/
│   │   │   ├── investigations/
│   │   │   ├── targets/
│   │   │   ├── findings/
│   │   │   ├── evidence/
│   │   │   ├── ai-workspace/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   │
│   │   └── api/
│   │       ├── ai/
│   │       ├── projects/
│   │       ├── investigations/
│   │       ├── findings/
│   │       ├── evidence/
│   │       └── reports/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── investigations/
│   │   ├── targets/
│   │   ├── findings/
│   │   ├── evidence/
│   │   ├── ai-workspace/
│   │   └── reports/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── workspaces/
│   │   ├── projects/
│   │   ├── targets/
│   │   ├── scope/
│   │   ├── investigations/
│   │   ├── observations/
│   │   ├── hypotheses/
│   │   ├── findings/
│   │   ├── evidence/
│   │   ├── ai/
│   │   ├── verification/
│   │   ├── reports/
│   │   └── audit/
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── auth.ts
│   │   ├── storage.ts
│   │   ├── permissions.ts
│   │   ├── logger.ts
│   │   ├── errors.ts
│   │   ├── validation.ts
│   │   └── utils.ts
│   │
│   ├── hooks/
│   ├── types/
│   ├── config/
│   └── constants/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example
├── .gitignore
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── README.md
└── components.json
```

Each module should follow a consistent internal structure where appropriate:

```text
modules/
└── investigations/
    ├── actions/
    ├── services/
    ├── repositories/
    ├── schemas/
    ├── types/
    └── utils/
```

Not every module needs every folder. Avoid creating empty abstractions before they are needed.

---

# 5. Authentication and User Management

## 5.1 Authentication

Use either Clerk or Auth.js as the authentication provider.

The initial implementation should support:

- Email and password authentication.
- Google authentication.
- Sign out.
- Protected application routes.
- Session management.
- Account settings.

Choose one authentication provider and use it consistently.

Do not implement two authentication systems.

## 5.2 Authorization

Authentication establishes who the user is.

Authorization establishes what the user can access.

Every protected operation must verify:

1. The user is authenticated.
2. The resource belongs to the user's workspace.
3. The user has the required permission.
4. The requested operation is permitted.

Do not rely only on hiding UI elements to enforce access restrictions.

All important permission checks must happen on the server.

## 5.3 Workspace Isolation

Every user-owned resource must be associated with a workspace.

Examples:

- Projects.
- Targets.
- Investigations.
- Findings.
- Evidence.
- Reports.
- AI conversations.

Every database query involving user-owned data must enforce workspace ownership.

A user must never be able to retrieve another workspace's information by changing a URL or resource ID.

---

# 6. Database Architecture

## 6.1 Database Connection

Use PostgreSQL with Prisma.

Create one shared Prisma client instance.

File:

`src/lib/prisma.ts`

Responsibilities:

- Initialize Prisma.
- Reuse the client appropriately during development.
- Export a shared database client.

## 6.2 Database Modules

Organize database operations around business modules.

Example:

`src/modules/projects/repositories/project.repository.ts`

This repository handles project-related database queries.

The corresponding service handles business rules.

Example:

`src/modules/projects/services/project.service.ts`

## 6.3 Database Principles

- Use UUID identifiers.
- Add timestamps to important records.
- Use foreign keys and relational constraints.
- Add indexes to frequently queried fields.
- Enforce workspace ownership.
- Use transactions for operations that must succeed or fail together.
- Avoid storing large evidence files directly in PostgreSQL.
- Keep audit records for important actions.

## 6.4 Important Relationships

```text
User
 └── Workspace
      ├── WorkspaceMember
      ├── Project
      │    ├── Target
      │    │    └── ScopeVersion
      │    ├── Investigation
      │    │    ├── Observation
      │    │    ├── Hypothesis
      │    │    ├── Finding
      │    │    ├── Evidence
      │    │    └── Report
      │    │         ├── ReportFinding
      │    │         └── ReportRevision
      │
      ├── ReportTemplate
      ├── AIConversation
      ├── AITask
      └── AuditLog
```

Use the detailed entity definitions and relationships in `DATABASE-SCHEMA.md` as the source of truth.

Do not create conflicting duplicate database models.

---

# 7. API Architecture

## 7.1 API Strategy

Use Next.js Route Handlers for external or asynchronous HTTP operations.

Use Server Actions for appropriate application mutations initiated by the UI.

Use server-side services for business logic shared between API routes and Server Actions.

The UI should never communicate directly with Prisma or private external APIs.

## 7.2 API Organization

Base path:

`/api`

Suggested endpoints:

### Projects

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/[projectId]
PATCH  /api/projects/[projectId]
DELETE /api/projects/[projectId]
```

### Targets

```text
GET    /api/projects/[projectId]/targets
POST   /api/projects/[projectId]/targets
GET    /api/targets/[targetId]
PATCH  /api/targets/[targetId]
```

### Investigations

```text
GET    /api/investigations
POST   /api/investigations
GET    /api/investigations/[investigationId]
PATCH  /api/investigations/[investigationId]
```

### Findings

```text
GET    /api/findings
POST   /api/findings
GET    /api/findings/[findingId]
PATCH  /api/findings/[findingId]
```

### Evidence

```text
GET    /api/evidence
POST   /api/evidence/upload-url
GET    /api/evidence/[evidenceId]
DELETE /api/evidence/[evidenceId]
```

### AI Tasks

```text
POST   /api/ai/tasks
GET    /api/ai/tasks/[taskId]
GET    /api/ai/conversations/[conversationId]
POST   /api/ai/conversations/[conversationId]/messages
```

### Reports

```text
GET    /api/reports
POST   /api/reports
GET    /api/reports/[reportId]
PATCH  /api/reports/[reportId]
```

These endpoints are architectural contracts. Implement them incrementally and adjust them as the actual UI and business requirements become clear.

## 7.3 API Response Format

Use a consistent response structure.

Successful response:

```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully"
}
```

Error response:

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource could not be found"
  }
}
```

Never return stack traces, database credentials, API keys, or internal server details to the browser.

## 7.4 Validation

Use Zod to validate incoming data.

Validation must happen on the server even if the frontend already validates the form.

Validate:

- Request body.
- Query parameters.
- Route parameters.
- File metadata.
- AI task inputs.
- AI-generated structured outputs.

---

# 8. AI Integration Architecture

## 8.1 Provider Integration

Anthropic Claude will be the initial AI provider.

Create a provider abstraction so that additional providers can be introduced later.

Suggested structure:

```text
modules/ai/
├── providers/
│   ├── anthropic.provider.ts
│   └── ai-provider.interface.ts
│
├── agents/
│   ├── research.agent.ts
│   ├── verification.agent.ts
│   ├── reporting.agent.ts
│   └── recon.agent.ts
│
├── orchestrator/
│   ├── ai-orchestrator.ts
│   ├── task-router.ts
│   └── context-manager.ts
│
├── services/
│   ├── conversation.service.ts
│   ├── task.service.ts
│   └── summary.service.ts
│
├── schemas/
│   ├── task.schema.ts
│   ├── observation.schema.ts
│   ├── hypothesis.schema.ts
│   └── verification.schema.ts
│
└── types/
    └── ai.types.ts
```

## 8.2 Provider Interface

Define a common interface for AI providers.

Example:

```ts
export interface AIProvider {
  generateResponse(input: {
    systemPrompt: string;
    messages: Array<{
      role: "user" | "assistant";
      content: string;
    }>;
    maxTokens: number;
  }): Promise<{
    content: string;
    usage?: {
      inputTokens: number;
      outputTokens: number;
    };
  }>;
}
```

The Anthropic implementation must satisfy this interface.

Keep provider-specific API logic inside the provider implementation.

## 8.3 AI Agent Responsibilities

### Recon Assistant

Organizes researcher-supplied observations and permitted passive information.

It must distinguish sourced information from assumptions.

### Research Assistant

Helps researchers:

- Organize investigation notes.
- Generate testable hypotheses.
- Identify missing evidence.
- Find duplicated hypotheses.
- Explain relevant security concepts.

### Verification Assistant

Reviews potential findings.

It should:

- Challenge unsupported claims.
- Identify contradictory evidence.
- Highlight missing information.
- Distinguish confirmed observations from assumptions.
- Explain confidence and uncertainty.

It cannot independently mark a vulnerability as confirmed.

### Reporting Assistant

Produces structured reports from human-reviewed findings.

It must not invent reproduction steps, evidence, impact, or affected assets.

## 8.4 AI Task Lifecycle

```text
CREATED
   |
   v
VALIDATING
   |
   v
AUTHORIZED
   |
   v
CONTEXT_ASSEMBLY
   |
   v
PROCESSING
   |
   v
OUTPUT_VALIDATION
   |
   v
AWAITING_REVIEW
   |
   v
COMPLETED
```

Alternative states:

- FAILED
- CANCELLED
- REJECTED
- NEEDS_REVIEW

Every task should store:

- Task ID.
- User ID.
- Workspace ID.
- Project ID.
- Investigation ID.
- Task type.
- Input reference.
- Output reference.
- Provider.
- Model.
- Status.
- Token usage.
- Error details.
- Creation time.
- Completion time.

## 8.5 Context Management

The AI must not depend entirely on the current conversation window.

Build a persistent context manager.

Context should be assembled from:

1. Workspace context.
2. Project context.
3. Target and scope context.
4. Investigation context.
5. Relevant observations.
6. Relevant hypotheses.
7. Evidence references.
8. Previous investigation summaries.

Use bounded retrieval instead of sending every record to Claude on every request.

The system should generate investigation summaries when a conversation becomes long.

Summaries must preserve:

- Research objective.
- Confirmed observations.
- Unverified hypotheses.
- Rejected hypotheses.
- Evidence references.
- Outstanding questions.
- Previous decisions.
- Next recommended research steps.

## 8.6 AI Output Validation

Never assume the model will always return valid structured data.

Use Zod to validate structured AI responses.

Example:

```ts
import { z } from "zod";

export const AIObservationSchema = z.object({
  title: z.string(),
  description: z.string(),
  source: z.string().optional(),
  confidence: z.enum([
    "low",
    "medium",
    "high"
  ]),
  requiresReview: z.boolean()
});
```

Invalid responses should be rejected or handled through a controlled retry.

Do not silently convert invalid AI output into confirmed findings.

## 8.7 AI Safety and Permission Boundaries

AI must remain an assistant, not an unrestricted security operator.

The system must enforce these restrictions:

- No unrestricted terminal execution.
- No unrestricted browser automation.
- No testing of targets without documented authorization.
- No actions against assets outside the approved scope.
- No destructive or disruptive testing.
- No automatic submission of vulnerability reports.
- No automatic confirmation of findings.
- No access to unrelated workspace data.
- No ability for AI to change authorization records.

For the initial release, AI tasks should focus on supplied evidence, documentation, researcher notes, permitted passive information, and controlled learning environments.

Any future active testing integration must have separate authorization controls, explicit human approval, and tightly restricted capabilities.

---

# 9. Target Authorization and Scope Enforcement

This is one of the most important parts of Sentinel Research.

## 9.1 Target Registration

A target can be registered for documentation without being authorized for testing.

Target statuses:

```text
PENDING
AUTHORIZED
EXPIRED
REVOKED
UNVERIFIED
```

## 9.2 Scope Management

Every authorized target must have a documented scope version.

Scope information should include:

- Authorized assets.
- Excluded assets.
- Allowed activities.
- Prohibited activities.
- Authorization evidence.
- Start date.
- Expiration date.
- Approval status.

## 9.3 Scope Validation

Before a task involving a target is accepted, the server must verify:

1. The target exists.
2. The user can access the target.
3. The target is authorized for the requested activity.
4. The relevant scope version is current.
5. The activity is explicitly permitted.
6. The authorization has not expired or been revoked.

If validation fails, block the task.

Never let a prompt override application-level authorization rules.

## 9.4 Scope Versioning

Scope changes must create a new immutable scope version.

Previous versions must remain available for audit purposes.

An AI assistant must never be allowed to create, approve, or expand an authorization scope.

---

# 10. Evidence Storage Architecture

## 10.1 Storage Strategy

Use private Cloudflare R2 object storage, accessed through the S3-compatible API, for uploaded files
(ADR-019). The bucket has no public access and no public object URLs.

Store file metadata in PostgreSQL. Do not store large screenshots, recordings, documents, or raw
evidence bodies in database records.

The storage adapter is an interface. Moving to AWS S3 or another S3-compatible provider must not
change domain or application code. Development may use a local filesystem adapter when the storage
variables are absent; production requires R2 and fails fast without it.

## 10.2 Evidence Types

Supported evidence may include:

- Screenshots.
- Text notes.
- Documents.
- Logs.
- Research references.
- Controlled-environment test results.

The canonical type enum is `SCREENSHOT`, `HTTP_REQUEST`, `HTTP_RESPONSE`, `TEXT_OBSERVATION`,
`DOCUMENT`, `LOG`, `EXTERNAL_REFERENCE`, `REPRODUCTION_NOTE`, and `OTHER` (ADR-004).

## 10.3 Evidence Metadata

Each evidence record contains:

```text
id
workspaceId
investigationId
projectId            (derived through the investigation)
evidenceType
title
description
fileName
storageKey           (null while quarantined)
quarantineKey        (null once active)
mimeType
fileSize
checksum
source
redactionStatus
redactionMethod
scanFindings
uploadedBy
redactionReviewedBy
redactionReviewedAt
activatedAt
version
supersedesId
deletedAt
createdAt
updatedAt
```

There is no `findingId` on evidence. Evidence links to findings only through `EvidenceLink`
(ADR-004). Evidence content is immutable after activation; corrections create a new record with
`version` and `supersedesId`.

## 10.4 Upload Flow

```text
Client selects file and redacts sensitive values
       |
       v
Client requests upload intent
       |
       v
Server checks authentication, workspace access, scope,
MIME type, size, and checksum declaration
       |
       v
Server creates quarantined evidence record and
returns short-lived presigned PUT URL
       |
       v
Client uploads directly to the quarantine prefix
       |
       v
Client calls finalize
       |
       v
Server reads the object, verifies size, checksum, and
magic bytes, and runs the advisory sensitive-data scan
       |
       v
Evidence is NOT_REVIEWED or QUARANTINED, never AI-visible
       |
       v
Human reviewer approves without change (VERIFIED_SAFE),
approves a sanitized replacement (REDACTED), or rejects
       |
       v
Server copies the object to the immutable active prefix,
re-verifies the checksum, records the reviewer, and
deletes the quarantine object
       |
       v
Approved evidence may link to findings and enter AI context
```

Key scheme (ADR-019):

```text
quarantine/{workspaceId}/{evidenceId}/{uploadId}
evidence/{workspaceId}/{investigationId}/{evidenceId}/v{version}
authorization/{workspaceId}/{scopeVersionId}/{artifactId}
```

Presigned PUT and GET URLs expire after five minutes. Evidence files are limited to 25 MB;
authorization artifacts are limited to 10 MB. Multipart upload is deferred.

The MIME allowlist is `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`,
`text/csv`, `application/json`, `application/xml`, `text/xml`, and `application/x-ndjson`.
Anything else is rejected at upload intent. The server sniffs magic bytes on finalize and rejects a
mismatch between the declared and detected type.

## 10.5 Quarantine and AI Gate

Quarantined and unreviewed evidence is visible only to its uploader, the workspace owner, and
reviewers who must resolve it. It is excluded from all AI and report paths.

Only `REDACTED` and `VERIFIED_SAFE` evidence may be linked to a finding through `EvidenceLink`, be
included in AI context, or be included in a report revision or export (ADR-013).

The AI context manager passes only extracted, redacted text. It never sends binary objects, raw
files, or quarantine content, and each task records the evidence IDs and versions used.

On rejection or replacement, the quarantine object is deleted and purged within 24 hours. Approved
evidence with a later-discovered sensitivity issue is revoked, removed from AI and report
eligibility, and superseded by a redacted version.

## 10.6 Evidence Security

- Keep evidence private; use signed URLs only after a server-side authorization check.
- Validate file types and sizes, including magic-byte sniffing.
- Use generated storage keys rather than trusting filenames.
- Record and re-verify SHA-256 checksums across quarantine and activation.
- Mark advisory scan results as advisory; a human reviewer makes the activation decision.
- Run the server on the Node.js runtime for storage, database, and AI paths.
- Avoid exposing secrets in logs.
- Never render uploaded HTML or scripts as trusted application content; HTML and SVG are rejected.
- Treat images and PDFs as untrusted at every layer.
- Malware scanning is deferred for the MVP; compensating controls are documented in ADR-019.

Evidence remains separate from AI-generated interpretations.

---

# 11. Finding and Verification Architecture

## 11.1 Finding Lifecycle

```text
DRAFT
  |
  v
NEEDS_VALIDATION
  |
  v
UNDER_REVIEW
  |
  +------> FALSE_POSITIVE
  |
  +------> REJECTED
  |
  v
CONFIRMED
  |
  v
REPORTABLE
  |
  v
CLOSED
```

Only an authorized human reviewer can confirm a finding.

## 11.2 Finding Requirements

A finding should contain:

- Title.
- Description.
- Affected asset.
- Vulnerability category.
- Severity.
- Impact explanation.
- Evidence references.
- Researcher notes.
- Verification status.
- Confidence level.
- Review history.

## 11.3 False-Positive Reduction

Sentinel Research must avoid treating AI speculation as a real vulnerability.

Implement:

- Evidence requirements.
- Duplicate detection.
- Contradiction detection.
- Clear confidence labels.
- Verification checklists.
- Human review.
- Rejected hypothesis history.

The AI must explicitly state when available information is insufficient.

---

# 12. Application State Management

## 12.1 Server State

Use server-side fetching for primary application data.

Use TanStack Query where client-side caching, background refresh, or interactive synchronization provides a clear benefit.

## 12.2 Client State

Use Zustand only for shared interactive state.

Potential use cases:

- AI workspace panel state.
- Investigation editor state.
- Sidebar preferences.
- Temporary multi-step UI state.

Do not duplicate all database records in Zustand.

## 12.3 Form State

Use React Hook Form with Zod validation for complex forms.

Examples:

- Project creation.
- Target registration.
- Investigation creation.
- Evidence metadata.
- Finding creation.
- AI task configuration.

---

# 13. Error Handling and Logging

## 13.1 Error Handling

Create a centralized application error system.

Suggested error categories:

```text
AUTHENTICATION_ERROR
AUTHORIZATION_ERROR
VALIDATION_ERROR
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
SCOPE_VALIDATION_ERROR
AI_PROVIDER_ERROR
AI_OUTPUT_VALIDATION_ERROR
STORAGE_ERROR
DATABASE_ERROR
RATE_LIMIT_ERROR
INTERNAL_SERVER_ERROR
```

Each error should have:

- A stable error code.
- A safe user-facing message.
- Internal diagnostic information.
- An appropriate HTTP status.

## 13.2 Logging

Use structured server-side logging.

Important events:

- Authentication failures.
- Permission denials.
- Scope validation failures.
- AI task creation.
- AI provider failures.
- Evidence uploads.
- Finding status changes.
- Report generation.
- Important workspace changes.

Do not log:

- API keys.
- Passwords.
- Authentication tokens.
- Sensitive uploaded file contents.
- Private credentials.

---

# 14. Security Architecture

Security must be built into the application from the beginning.

## 14.1 Application Security

Implement:

- Server-side authorization.
- Input validation.
- Secure session handling.
- CSRF protection where applicable.
- Rate limiting.
- Secure HTTP headers.
- Safe error handling.
- Dependency updates.
- Protection against insecure direct object references.
- Workspace-level data isolation.

## 14.2 File Security

Implement:

- Private storage.
- Upload size restrictions.
- File type validation.
- Short-lived download links.
- Access checks.
- Safe file previews.
- Evidence redaction.

## 14.3 AI Security

Treat all user-supplied research content, uploaded documents, and external text as untrusted input.

Use clear separation between system instructions and research content.

Do not allow content inside uploaded files or external pages to override application rules.

The AI must not receive credentials or unrestricted access to application infrastructure.

## 14.4 Auditability

Record important user and system actions.

Audit records should identify:

- Actor.
- Workspace.
- Action.
- Affected resource.
- Timestamp.
- Relevant status changes.

Keep audit logs separate from ordinary application activity logs.

---

# 15. Environment Configuration

Create `.env.example` in the project root.

Example:

```env
# Application
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=

# Authentication
AUTH_SECRET=
AUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Anthropic
ANTHROPIC_API_KEY=

# Object Storage (private Cloudflare R2 bucket via the S3-compatible API)
STORAGE_ENDPOINT=
STORAGE_REGION=auto
STORAGE_BUCKET=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
# Development-only local filesystem adapter signing secret; storage is
# required in production and never falls back to local files.
EVIDENCE_LOCAL_SIGNING_SECRET=

# Logging
LOG_LEVEL=debug
```

The authentication variables depend on the provider selected.

For Clerk, use its documented server-side and public environment variable names instead.

Never commit `.env.local` or real credentials to GitHub.

Keep private environment variables server-side. Only variables explicitly intended for browser use should use the `NEXT_PUBLIC_` prefix.

The object storage variables describe a private Cloudflare R2 bucket (ADR-019). Production startup
fails when they are missing; there is no silent fallback to local files. R2 credentials are scoped
to the bucket and separated per environment.

---

# 16. Background Tasks and AI Processing

AI tasks may take longer than normal HTTP requests.

Do not rely on a browser request remaining open until every AI operation finishes.

## 16.1 Initial Approach

Start with a database-backed task lifecycle.

A task is created and stored before processing begins.

For the first development version, a controlled server-side processing mechanism can handle short tasks.

## 16.2 Future Approach

When processing volume grows, introduce a dedicated background job system.

Possible options:

- Inngest.
- Trigger.dev.
- BullMQ with Redis.

The job system should support:

- Task retries.
- Failure handling.
- Task status updates.
- Idempotency.
- Cancellation.
- Processing limits.

Do not introduce a queue system before the core application workflows are working.

## 16.3 Task Reliability

Every AI task must have:

- A unique task ID.
- A defined status.
- An associated user and workspace.
- Input validation.
- Output validation.
- Error handling.
- Usage tracking.

Prevent duplicate task execution where possible.

---

# 17. Testing Architecture

Testing should be introduced alongside implementation.

## 17.1 Unit Tests

Use Vitest.

Test:

- Scope validation.
- Permission checks.
- Finding status transitions.
- Zod schemas.
- AI output validation.
- Context assembly.
- Duplicate hypothesis detection.

## 17.2 Integration Tests

Test interactions between:

- Prisma and PostgreSQL.
- Authentication and protected services.
- Project and target modules.
- Investigation and evidence modules.
- AI orchestration and provider adapters.
- Finding and verification workflows.

## 17.3 End-to-End Tests

Use Playwright.

Important user journeys:

1. Register and sign in.
2. Complete onboarding.
3. Create a workspace project.
4. Register a target.
5. Document authorization and scope.
6. Create an investigation.
7. Add observations and hypotheses.
8. Upload evidence.
9. Request AI analysis.
10. Review a potential finding.
11. Generate a report.

Use mock providers and controlled test data where appropriate.

Never run tests against third-party targets without authorization.

## 17.4 Security Tests

Test:

- Workspace data isolation.
- Unauthorized resource access.
- Expired authorization handling.
- Revoked scope handling.
- Invalid upload attempts.
- Missing authentication.
- Invalid AI responses.
- Prompt injection resistance.
- Secret exposure prevention.

---

# 18. Deployment Architecture

## 18.1 Initial Deployment

Deploy the Next.js application to Vercel or a compatible platform.

Use managed PostgreSQL.

Use private object storage for evidence.

Configure production environment variables through the hosting provider.

## 18.2 Environments

Maintain separate environments:

```text
Development
     |
     v
Staging
     |
     v
Production
```

Development is for local work.

Staging is for integration testing.

Production is for real users and their data.

## 18.3 Database Migrations

Use Prisma migrations.

Development:

```bash
yarn prisma migrate dev
```

Production:

```bash
yarn prisma migrate deploy
```

Never use development migration commands against the production database.

---

# 19. Development Conventions

## 19.1 Package Manager

Use Yarn consistently.

Do not mix npm, pnpm, and Yarn in this project.

## 19.2 Naming Conventions

- Components: PascalCase.
- Functions: camelCase.
- Variables: camelCase.
- Constants: UPPER_SNAKE_CASE where appropriate.
- Database models: PascalCase.
- Database fields: camelCase.
- Route folders: lowercase.

## 19.3 Code Organization

Keep components focused.

Move complex business logic into module services.

Move reusable database queries into repositories.

Keep validation schemas close to the module that owns them.

Avoid unnecessary global state.

Avoid putting the entire application into a few large files.

## 19.4 Git Workflow

Use feature branches.

Suggested naming:

```text
feature/authentication
feature/project-management
feature/investigations
feature/ai-workspace
feature/evidence-management
feature/report-generation
fix/scope-validation
```

Commit messages should describe the change.

Examples:

```text
feat: add project creation workflow
feat: implement target scope management
fix: enforce workspace ownership checks
test: add finding verification tests
```

---

# 20. Implementation Order

Build Sentinel Research in the following order.

## Phase 1: Project Foundation

- Initialize Next.js.
- Configure TypeScript.
- Configure Tailwind CSS.
- Install shadcn/ui.
- Configure fonts and design tokens.
- Set up application layouts.
- Configure ESLint and formatting.
- Initialize Git.
- Create the documentation structure.

**Deliverable:** A working application shell.

## Phase 2: Authentication and Database

- Configure authentication.
- Connect PostgreSQL.
- Configure Prisma.
- Implement User.
- Implement Workspace.
- Implement WorkspaceMember.
- Add protected routes.
- Implement server-side authorization.

**Deliverable:** Users can securely access their own workspace.

## Phase 3: Project and Target Management

- Project CRUD.
- Target registration.
- Authorization documentation.
- Scope versioning.
- Scope validation.
- Target details pages.

**Deliverable:** Researchers can organize projects and document authorized targets.

## Phase 4: Investigation Management

- Create investigations.
- Add observations.
- Create hypotheses.
- Track investigation status.
- Implement session summaries.
- Build investigation workspace.

**Deliverable:** Researchers can maintain structured investigation records.

## Phase 5: AI Integration

- Configure Anthropic.
- Create provider abstraction.
- Implement AI task management.
- Implement context manager.
- Implement conversation persistence.
- Build Research Assistant.
- Build Verification Assistant.
- Add output validation.
- Implement AI usage tracking.

**Deliverable:** Users can request structured AI assistance without losing research context.

## Phase 6: Evidence and Findings

- Implement private evidence storage.
- Add evidence metadata.
- Build evidence library.
- Implement finding creation.
- Add verification reviews.
- Implement finding status transitions.
- Add duplicate detection.

**Deliverable:** Potential findings can be evaluated against stored evidence.

## Phase 7: Reporting

- Build report editor.
- Generate structured reports.
- Support evidence references.
- Add report revisions.
- Export reports.

**Deliverable:** Researchers can produce evidence-backed reports.

## Phase 8: Testing and Deployment

- Unit testing.
- Integration testing.
- End-to-end testing.
- Security checks.
- Performance checks.
- Staging deployment.
- Production deployment.

**Deliverable:** A tested and deployable initial release.

---

# 21. Architecture Rules That Must Not Be Violated

These rules apply throughout development.

1. Never expose private API keys in client-side code.
2. Never allow users to access another workspace's data.
3. Never allow AI to modify authorization or scope records.
4. Never perform target-related testing without validated authorization.
5. Never allow AI-generated claims to become confirmed findings automatically.
6. Never treat an AI confidence score as proof.
7. Never store large uploaded files directly in PostgreSQL.
8. Never trust AI-generated structured output without validation.
9. Never let UI components contain complex business logic.
10. Never create duplicate database models for the same business entity.
11. Never introduce unnecessary microservices.
12. Never make AI availability a requirement for core application functionality.
13. Never submit external reports automatically.
14. Never discard investigation history when starting a new AI conversation.
15. Every important operation must have appropriate permission checks and error handling.

---

# 22. Definition of Done

A feature is considered complete when:

- The UI is implemented.
- Required server-side logic exists.
- Input validation is implemented.
- Authentication and authorization are enforced.
- Database operations work correctly.
- Loading and error states are handled.
- Relevant tests pass.
- No secrets are exposed.
- Documentation is updated where necessary.

A visually complete screen is not necessarily a completed feature.

---

# 23. Final Architecture Decision

Sentinel Research will begin as a modular monolith built with:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- PostgreSQL.
- Prisma.
- Clerk or Auth.js.
- Anthropic Claude.
- Zod.
- Private object storage.
- Vitest.
- Playwright.
- Yarn.

The architecture prioritizes maintainability, evidence integrity, secure authorization, reliable AI workflows, and human-controlled verification.

The initial product should focus on building a dependable research management workflow before introducing complex automation.

**The goal is not to build an AI that claims to find every vulnerability. The goal is to build a system that helps researchers investigate carefully, preserve evidence, challenge assumptions, and produce trustworthy results.**