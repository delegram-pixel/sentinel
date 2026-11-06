# SENTINEL RESEARCH
# Product Requirements Document (PRD)

**Version:** 1.0  
**Status:** Initial Product Specification  
**Product Type:** AI-Powered Security Research Workspace  
**Platform:** Web Application

---

## 1. Product Overview

### 1.1 Product Description

Sentinel Research is an AI-powered security research workspace designed to help cybersecurity learners, bug bounty researchers, penetration testers and security teams conduct structured web application security investigations.

The platform combines AI-assisted research, investigation management, evidence collection, vulnerability verification and report generation in one environment.

Unlike generic AI chat interfaces, Sentinel Research maintains persistent investigation context, tracks previously completed work, identifies unsupported vulnerability claims and guides users through a structured research process.

The platform offers two operating modes:

- **Guided Mode:** The user works interactively with AI, receiving explanations, recommendations and assistance at every stage.
- **Delegated Mode:** The user assigns defined, authorized research tasks to specialized AI assistants, reviews their results and approves subsequent actions.

The platform prioritizes evidence quality, accuracy, transparency and human control.

### 1.2 Problem Statement

Security researchers increasingly use AI assistants to investigate web application vulnerabilities.

However, unstructured AI-assisted research creates several problems:

1. AI frequently generates speculative vulnerability claims.
2. Researchers struggle to distinguish real vulnerabilities from false positives.
3. Investigation context gets lost between conversations.
4. AI repeats previously completed research.
5. There is no consistent system for organizing hypotheses and evidence.
6. Findings are often poorly documented.
7. Beginners lack guidance on how to investigate security issues systematically.
8. Researchers spend considerable time organizing information instead of understanding the security problem.

Sentinel Research addresses these problems through a structured investigation environment.

### 1.3 Product Vision

To become a trusted research environment where humans and AI collaborate to conduct accurate, transparent and reproducible security investigations.

### 1.4 Product Mission

Make structured security research more accessible, organized and reliable through AI assistance, persistent investigation memory and evidence-based verification.

---

## 2. Product Objectives

### Primary Objectives

- Reduce unsupported AI-generated vulnerability claims.
- Maintain persistent context across investigation sessions.
- Provide structured investigation workflows.
- Improve evidence collection and organization.
- Enable independent review of potential findings.
- Simplify security report preparation.
- Help beginners understand the reasoning behind security investigations.

### Secondary Objectives

- Support multiple AI providers.
- Support individual and team research.
- Introduce guided security learning.
- Provide reusable investigation templates.
- Offer integrations with security research tools.

### Success Metrics

| Metric | Measurement |
|---|---|
| Investigation completion | Percentage of investigations reaching a documented conclusion |
| Evidence completeness | Percentage of findings containing required evidence |
| False-positive reduction | Unsupported claims rejected during review |
| Context continuity | Percentage of sessions successfully resumed |
| Repeated investigation | Frequency of duplicate or unnecessary tests |
| Report quality | Percentage of reports passing completeness checks |
| User engagement | Active investigations per user |

Do not use AI confidence scores as a substitute for measured verification quality.

---

## 3. Target Audience

### 3.1 Cybersecurity Beginners

Needs:
- Guided investigation workflows.
- Explanations of security concepts.
- Clear next steps.
- Structured practice environments.
- Feedback on investigation decisions.

### 3.2 Individual Bug Bounty Researchers

Needs:
- Multiple research projects.
- Target and scope management.
- Investigation history.
- Evidence organization.
- AI-assisted analysis.
- Report generation.

### 3.3 Professional Penetration Testers

Needs:
- Multiple engagements.
- Structured findings.
- Evidence traceability.
- Reusable templates.
- Client-ready reporting.
- Investigation audit history.

### 3.4 Security Teams

Needs:
- Shared research workspaces.
- Team roles and permissions.
- Finding review.
- Collaboration.
- Activity history.
- Centralized evidence management.

The MVP will prioritize individual researchers and learners while maintaining an architecture that supports teams later.

---

## 4. Core Product Modules

### 4.1 Research Dashboard

Purpose: Provide an overview of research activities.

Features:
- Total projects.
- Active investigations.
- Pending AI reviews.
- Confirmed findings.
- Rejected hypotheses.
- Recent activity.
- Investigation progress.
- Quick project creation.

### 4.2 Project Management

Purpose: Organize research into independent projects.

Features:
- Create projects.
- Edit project details.
- Archive projects.
- Project descriptions.
- Project status.
- Project-specific settings.
- Associated targets and investigations.

### 4.3 Target and Scope Management

Purpose: Establish authorization and testing boundaries.

Features:
- Target registration.
- Asset identification.
- Program scope documentation.
- Allowed assets.
- Excluded assets.
- Permitted testing methods.
- Restrictions.
- Authorization evidence.
- Scope change history.

Safety requirements:
- No active testing without an explicit authorization record.
- Excluded assets must remain inaccessible to testing workflows.
- Scope changes require user confirmation.
- Expired or uncertain authorization blocks delegated testing.
- The system must not assume that public accessibility means permission to test.

### 4.4 AI Research Workspace

Purpose: Provide a persistent environment for AI-assisted investigation.

Features:
- Conversational AI interface.
- Investigation-specific context.
- Research history.
- AI task delegation.
- Structured AI responses.
- File and evidence references.
- Investigation summaries.
- Next-action recommendations.
- Multiple AI provider support.

### 4.5 Investigation Management

Purpose: Track security research systematically.

Features:
- Create investigations.
- Assign investigation IDs.
- Link investigations to targets.
- Record hypotheses.
- Track completed research.
- Record observations.
- Maintain investigation status.
- Resume previous investigations.
- Identify repeated work.

### 4.6 Finding Management

Purpose: Organize potential vulnerabilities.

Features:
- Finding title.
- Vulnerability category.
- Description.
- Affected feature.
- Severity assessment.
- Evidence references.
- Validation status.
- Review history.
- Duplicate detection.

Finding statuses:

- Idea
- Observed
- Needs Validation
- Confirmed
- Rejected
- False Positive
- Reportable

### 4.7 Evidence Management

Purpose: Maintain traceable evidence.

Supported evidence:
- Text observations.
- Screenshots.
- HTTP request and response records.
- Files.
- Reproduction notes.
- Reviewer comments.
- External references.

Each evidence record must contain:
- Unique identifier.
- Associated investigation.
- Evidence type.
- Description.
- Creation timestamp.
- Source.
- Author.
- Integrity metadata where applicable.

Sensitive information must be redacted before evidence activation and before any AI processing.
Uploads first enter an encrypted, private quarantine that is accessible only to the uploader and
reviewers. Quarantined content is never linked to findings, sent to AI, or included in reports. A
human reviewer must approve the evidence as `REDACTED` or `VERIFIED_SAFE` before it becomes part of
the accessible evidence library (ADR-013).

### 4.8 Verification Engine

Purpose: Challenge and validate potential findings.

Features:
- Independent AI review.
- Evidence completeness checks.
- Contradictory evidence detection.
- Expected versus observed behaviour comparison.
- Impact assessment.
- Missing evidence identification.
- Human review.
- Verification history.

AI cannot independently promote a finding to Confirmed or Reportable.

### 4.9 Report Builder

Purpose: Generate structured reports.

A report belongs to one investigation and may include one or more findings that a human has
confirmed or marked reportable. Each revision snapshots the included findings and the approved
evidence references used at generation time.

Features:
- Report templates.
- Finding summaries.
- Reproduction instructions.
- Evidence references.
- Impact explanation.
- Remediation suggestions.
- Markdown export (canonical).
- PDF export (derived, basic server-side rendering; ADR-027).
- Report revision history.

Reports must distinguish verified observations from assumptions.

### 4.10 Learning Centre

Purpose: Support cybersecurity education.

Features:
- Security learning paths.
- Vulnerability explanations.
- Guided exercises.
- Practice lab references.
- Investigation walkthroughs.
- Learning progress.

The learning centre is planned for a later release.

---

## 5. Operating Modes

### Guided Mode

The user controls the investigation.

AI:
- Explains concepts.
- Organizes observations.
- Suggests research questions.
- Reviews evidence.
- Identifies missing information.
- Recommends next steps.

### Delegated Mode

The user assigns specific tasks to AI assistants.

AI:
- Receives a defined task.
- Reads authorized project context.
- Performs permitted analysis.
- Records its observations.
- Produces structured results.
- Requests approval where required.

Delegated mode must never bypass project scope or safety restrictions.

---

## 6. User Roles

### MVP

**Individual User**
- Owns projects.
- Creates investigations.
- Manages targets.
- Uses AI assistants.
- Reviews findings.
- Generates reports.

### Future Release

**Workspace Owner**
- Manages team workspaces.

**Administrator**
- Manages users and workspace configuration.

**Researcher**
- Conducts investigations.

**Reviewer**
- Reviews findings and evidence.

---

## 7. Core User Journey

1. User registers.
2. User creates a research project.
3. User registers an authorized target or practice environment.
4. User documents testing scope.
5. User creates an investigation.
6. AI helps organize observations.
7. User creates or reviews potential findings.
8. AI challenges the evidence.
9. User approves the conclusion.
10. User generates a report or closes the investigation.

---

## 8. MVP Scope

### Included

- Authentication.
- Research dashboard.
- Project management.
- Target management.
- Scope documentation.
- AI chat workspace.
- Investigation management.
- Hypothesis tracking.
- Evidence management.
- AI verification.
- Human approval.
- Report generation.
- Investigation history.

### Excluded

- Autonomous exploitation.
- Unrestricted scanning.
- Automatic vulnerability submission.
- Unrestricted shell execution.
- Unrestricted browser automation.
- Team collaboration.
- Advanced billing.
- Marketplace.
- Full learning management system.

---

## 9. Non-Functional Requirements

### Performance
- Responsive dashboard.
- Efficient investigation retrieval.
- Background processing for longer AI tasks.
- Pagination for large datasets.

### Security
- Secure authentication.
- Server-side authorization.
- Encrypted transport.
- Protected evidence storage.
- API key protection.
- Audit logging.
- Rate limiting.
- Secure file handling.

### Reliability
- Persistent investigation records.
- AI task status tracking.
- Retry handling.
- Error reporting.
- Recovery from interrupted sessions.

### Usability
- Clear navigation.
- Accessible components.
- Responsive layouts.
- Understandable AI explanations.
- Clear investigation statuses.

---

## 10. Product Risks

| Risk | Mitigation |
|---|---|
| AI hallucinations | Evidence requirements and independent review |
| False positives | Verification workflow |
| Repeated research | Persistent investigation memory |
| Unauthorized testing | Scope enforcement |
| Sensitive evidence exposure | Redaction and access control |
| AI provider outages | Provider abstraction and retry handling |
| Excessive AI costs | Usage limits and task budgets |

---

## 11. MVP Acceptance Criteria

The MVP is considered functional when:

1. Users can register and authenticate.
2. Users can create and manage projects.
3. Users can register authorized research environments.
4. Users can document scope restrictions.
5. Users can create investigations.
6. AI can read relevant investigation context.
7. Users can record hypotheses and observations.
8. Evidence can be attached to findings.
9. AI can perform structured evidence reviews.
10. Human approval is required for final classifications.
11. Investigation history persists across sessions.
12. Users can generate reports from documented findings.
13. Unauthorized actions are blocked by the application.

---

## 12. Product Direction

Sentinel Research will differentiate itself through three capabilities:

1. Persistent investigation memory.
2. Evidence-driven false-positive prevention.
3. Structured collaboration between human researchers and AI.

The product should prioritize investigation quality over autonomous activity.