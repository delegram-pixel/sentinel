# SENTINEL RESEARCH
# Software Implementation Plan

**Version:** 1.0  
**Status:** Initial Development Roadmap  
**Approach:** Incremental Development  
**Architecture:** Modular Monolith

---

## 1. Implementation Overview

Sentinel Research will be developed incrementally.

The implementation strategy prioritizes:

1. A working application foundation.
2. Reliable data management.
3. Structured investigation workflows.
4. Persistent AI context.
5. Evidence management.
6. False-positive verification.
7. Report generation.

Each phase must produce a working, testable application.

Avoid implementing every module simultaneously.

---

## 2. Development Principles

### Architecture
- Modular monolith.
- Server-side business logic.
- Domain-based organization.
- Shared validation schemas.
- Reusable UI components.

### Code Quality
- TypeScript strict mode.
- Consistent naming.
- Small reusable functions.
- Explicit error handling.
- Centralized validation.
- Minimal duplication.

### Development Workflow
- Implement one feature at a time.
- Test before moving forward.
- Review architecture decisions.
- Maintain documentation.
- Use Git branches.
- Keep the main branch stable.

### Package Management

Use Yarn consistently.

Do not mix npm, pnpm and Yarn installation workflows within the project.

---

## 3. Proposed Project Structure

```text
sentinel-research/
│
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── public/
│   ├── images/
│   └── icons/
│
├── src/
│   │
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx
│   │   │   ├── features/
│   │   │   └── pricing/
│   │   │
│   │   ├── (auth)/
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   │
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── projects/
│   │   │   ├── investigations/
│   │   │   ├── targets/
│   │   │   ├── findings/
│   │   │   ├── evidence/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   │
│   │   └── api/
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   ├── investigations/
│   │   ├── findings/
│   │   ├── evidence/
│   │   ├── ai-workspace/
│   │   └── reports/
│   │
│   ├── modules/
│   │   ├── auth/
│   │   ├── workspaces/
│   │   ├── projects/
│   │   ├── targets/
│   │   ├── scope/
│   │   ├── investigations/
│   │   ├── findings/
│   │   ├── evidence/
│   │   ├── ai/
│   │   ├── verification/
│   │   └── reports/
│   │
│   ├── lib/
│   │   ├── prisma/
│   │   ├── storage/
│   │   ├── validation/
│   │   ├── permissions/
│   │   ├── utilities/
│   │   └── errors/
│   │
│   ├── hooks/
│   ├── types/
│   └── config/
│
├── docs/
│   ├── PRD.md
│   ├── TRD.md
│   ├── APP-FLOW.md
│   ├── DESIGN-BRIEF.md
│   ├── DATABASE-SCHEMA.md
│   ├── AI-ARCHITECTURE.md
│   └── IMPLEMENTATION-PLAN.md
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── CLAUDE.md
├── .env.example
├── package.json
└── README.md
```

This is the intended structure. Adjust individual folders as implementation needs become clearer.

---

## 4. Phase 1 — Project Foundation

### Objectives

Establish the development environment and application foundation.

### Tasks

#### 4.1 Initialize Application

- Create Next.js application.
- Configure TypeScript.
- Configure Tailwind CSS.
- Install shadcn/ui.
- Configure ESLint.
- Configure Prettier.
- Set up Git.
- Establish environment variables.

#### 4.2 Design System

Implement:
- Color tokens.
- Typography.
- Spacing.
- Buttons.
- Inputs.
- Dialogs.
- Dropdowns.
- Tables.
- Status indicators.
- Cards.
- Navigation.

#### 4.3 Application Shell

Build:
- Sidebar.
- Header.
- Breadcrumbs.
- Main content layout.
- Responsive navigation.
- User menu.

#### 4.4 Authentication

Implement:
- Registration.
- Login.
- Logout.
- Session validation.
- Protected routes.
- User profile synchronization.

#### 4.5 Database Setup

- Configure PostgreSQL.
- Install Prisma.
- Create initial schema.
- Run migrations.
- Seed development data.

### Deliverables

- Working Next.js application.
- Authentication.
- Database connection.
- Design system.
- Dashboard shell.

### Completion Criteria

Users can register, authenticate and access a protected dashboard.

---

## 5. Phase 2 — Project and Target Management

### Objectives

Build the foundational research organization system.

### Tasks

#### 5.1 Project Management

Implement:
- Project creation.
- Project listing.
- Project details.
- Project editing.
- Project archival.

#### 5.2 Target Management

Implement:
- Target registration.
- Target listing.
- Target details.
- Target editing.
- Authorization metadata.

#### 5.3 Scope Management

Implement:
- Allowed assets.
- Excluded assets.
- Permitted activities.
- Prohibited activities.
- Authorization expiration.
- Scope version history.

#### 5.4 Permission Enforcement

Implement:
- Project ownership checks.
- Target authorization checks.
- Scope validation.
- Server-side access control.

### Deliverables

- Project dashboard.
- Project details.
- Target management.
- Scope management.

### Completion Criteria

Users can create projects and document authorized research environments without enabling unauthorized testing.

---

## 6. Phase 3 — Investigation Management

### Objectives

Build the central research workflow.

### Tasks

#### 6.1 Investigation Creation

Implement:
- Investigation form.
- Investigation ID.
- Project association.
- Target association.
- Investigation status.

#### 6.2 Investigation Workspace

Build:
- Investigation overview.
- Navigation panels.
- Context panel.
- Notes.
- Activity history.

#### 6.3 Observation Management

Implement:
- Observation creation.
- Observation editing.
- Observation categorization.
- Observation history.

#### 6.4 Hypothesis Management

Implement:
- Hypothesis creation.
- Vulnerability categories.
- Supporting observations.
- Contradictory observations.
- Hypothesis status changes.

#### 6.5 Investigation Continuity

Implement:
- Session summaries.
- Completed work tracking.
- Unresolved questions.
- Next-action tracking.

### Deliverables

A functional research workspace without AI automation.

### Completion Criteria

Users can manage investigations manually and resume them without losing historical context.

---

## 7. Phase 4 — AI Integration

### Objectives

Integrate Claude and establish the AI orchestration foundation.

### Tasks

#### 7.1 Provider Integration

- Configure Anthropic API.
- Create provider abstraction.
- Implement API communication.
- Handle provider errors.
- Track token usage.

#### 7.2 AI Conversation

Implement:
- Chat interface.
- Message persistence.
- Conversation history.
- Streaming responses where supported.
- Investigation context retrieval.

#### 7.3 Context Manager

Implement:
- Project context.
- Target context.
- Scope context.
- Investigation context.
- Session summaries.
- Relevant evidence references.

#### 7.4 Recon Assistant

Implement:
- Structured observation analysis.
- Reconnaissance summaries.
- Known versus unknown information.

#### 7.5 Research Assistant

Implement:
- Hypothesis generation.
- Duplicate detection.
- Missing-information identification.
- Next-action recommendations.

#### 7.6 AI Task Management

Implement:
- Task creation.
- Task status.
- Task history.
- Failure handling.
- Token usage.
- Retry management.

### Deliverables

- Working AI workspace.
- Claude integration.
- Persistent AI conversations.
- Initial specialized assistants.

### Completion Criteria

AI can understand the current investigation, respond with structured information and preserve relevant context across sessions.

---

## 8. Phase 5 — Evidence and Verification

### Objectives

Build the main product differentiator.

### Tasks

#### 8.1 Evidence Management

Implement:
- Evidence upload.
- Evidence metadata.
- Private storage.
- Evidence preview.
- Evidence linking.
- Sensitive-data redaction.

#### 8.2 Finding Management

Implement:
- Finding creation.
- Finding details.
- Evidence relationships.
- Status management.
- Severity assessment.

#### 8.3 Verification Assistant

Implement:
- Evidence retrieval.
- Structured review prompts.
- Supporting evidence identification.
- Contradictory evidence identification.
- Missing evidence identification.
- Impact assessment.

#### 8.4 Human Approval

Implement:
- Review interface.
- Approval controls.
- Rejection controls.
- Additional evidence requests.
- Decision history.

#### 8.5 Anti-Repetition Logic

Implement:
- Hypothesis similarity checks.
- Existing investigation lookup.
- Completed task lookup.
- Duplicate warnings.
- Investigation continuation summaries.

### Deliverables

- Evidence library.
- Finding management.
- Verification workflow.
- Human review interface.

### Completion Criteria

Potential findings can be reviewed using traceable evidence, and AI cannot independently establish final confirmation.

---

## 9. Phase 6 — Report Generation

### Objectives

Complete the research lifecycle.

### Tasks

- Create report templates.
- Build report editor.
- Retrieve approved findings.
- Retrieve linked evidence.
- Generate structured drafts.
- Validate report completeness.
- Support editing.
- Add revision history.
- Export Markdown.
- Export PDF.

### Deliverables

Functional report builder.

### Completion Criteria

Users can generate reports from approved, evidence-backed findings.

---

## 10. Phase 7 — Testing and Quality Assurance

### Objectives

Validate the product before public release.

### Testing Areas

#### Authentication
- Registration.
- Login.
- Logout.
- Session expiration.

#### Authorization
- Cross-user data access.
- Project ownership.
- Workspace isolation.
- Scope restrictions.

#### Investigation
- Creation.
- Updates.
- Status transitions.
- History.
- Continuation.

#### AI
- Structured response validation.
- Invalid AI outputs.
- Hallucinated evidence references.
- Duplicate hypotheses.
- Prompt injection.
- Provider failures.

#### Evidence
- File validation.
- Storage permissions.
- Evidence relationships.
- Redaction.

#### Reporting
- Evidence references.
- Report completeness.
- Export integrity.

### Deliverables

- Unit tests.
- Integration tests.
- End-to-end tests.
- Security test results.
- Release checklist.

---

## 11. Phase 8 — Deployment

### Objectives

Prepare the application for controlled public access.

### Tasks

- Configure production database.
- Configure authentication.
- Configure private file storage.
- Configure AI provider secrets.
- Set up production environment variables.
- Configure deployment.
- Configure database backups.
- Configure error monitoring.
- Configure usage monitoring.
- Run migrations.
- Perform production smoke tests.

### Deliverables

Production deployment.

---

## 12. Suggested Development Sequence

| Phase | Priority | Dependency |
|---|---|---|
| Foundation | Critical | None |
| Project and target management | Critical | Foundation |
| Investigation management | Critical | Project management |
| AI integration | Critical | Investigation management |
| Evidence and verification | Critical | AI and investigations |
| Report generation | High | Verification |
| Quality assurance | Critical | All MVP modules |
| Deployment | Critical | QA |

---

## 13. Development Milestones

### Milestone 1
A working authenticated application with project management.

### Milestone 2
A functional investigation workspace.

### Milestone 3
Persistent Claude conversations and research context.

### Milestone 4
Evidence management and structured findings.

### Milestone 5
Independent AI verification and human approval.

### Milestone 6
Report generation and complete investigation lifecycle.

### Milestone 7
Security testing and initial release.

---

## 14. Git Workflow

Recommended branches:

- main
- develop
- feature/authentication
- feature/dashboard
- feature/projects
- feature/targets
- feature/investigations
- feature/ai-workspace
- feature/evidence
- feature/verification
- feature/reports

Requirements:
- Use meaningful commit messages.
- Keep feature branches focused.
- Review changes before merging.
- Run tests before merging.
- Never commit secrets.
- Maintain a stable main branch.

---

## 15. Definition of Done

A feature is complete when:

1. Requirements are implemented.
2. UI is responsive.
3. Input validation exists.
4. Authorization is enforced.
5. Loading states exist.
6. Error states exist.
7. Database operations are tested.
8. Relevant automated tests pass.
9. Documentation is updated.
10. No critical known security issue remains.

---

## 16. Final Implementation Principle

Build Sentinel Research as a reliable investigation management platform first.

Introduce AI capabilities gradually.

The application must remain useful even when the AI provider is unavailable.

The investigation records, evidence, findings and reports belong to the user and must remain accessible independently of any AI conversation.

The success of the product depends on the quality of its research workflow, not the number of AI agents it contains.