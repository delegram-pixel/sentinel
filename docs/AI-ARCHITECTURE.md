# SENTINEL RESEARCH
# AI Agent Architecture & Orchestration

**Version:** 1.0  
**Status:** Initial Architecture Specification  
**Primary AI Provider:** Anthropic Claude API

---

## 1. Architecture Overview

Sentinel Research uses a centralized AI orchestration architecture with specialized assistants.

The platform does not treat every AI assistant as an independent autonomous agent.

Instead, a central orchestrator:
- Receives user requests.
- Identifies the required task.
- Retrieves relevant investigation context.
- Selects an appropriate assistant.
- Enforces task permissions.
- Validates responses.
- Stores task results.
- Updates investigation records when approved.

All assistants operate using shared investigation context.

### Primary Architecture

USER
  |
  v
AI WORKSPACE
  |
  v
AI ORCHESTRATOR
  |
  +-- Context Manager
  |
  +-- Permission and Scope Validator
  |
  +-- Task Router
  |
  +-- Prompt Manager
  |
  +-- Response Validator
  |
  +-- Investigation Memory
  |
  +-- AI PROVIDER INTERFACE
          |
          +-- Recon Assistant
          +-- Research Assistant
          +-- Verification Assistant
          +-- Reporting Assistant
  |
  v
STRUCTURED RESULTS
  |
  v
HUMAN REVIEW
  |
  v
DATABASE

---

## 2. Core Architectural Principles

### 2.1 Centralized Orchestration

All AI tasks pass through the orchestrator.

Assistants must not bypass:
- Authentication.
- Project ownership.
- Target authorization.
- Scope restrictions.
- Task permissions.
- Evidence validation.

### 2.2 Shared Investigation Context

Every assistant should receive only the information relevant to its assigned task.

The context manager retrieves:
- Project information.
- Target details.
- Active scope version.
- Investigation summary.
- Previous observations.
- Existing hypotheses.
- Relevant findings.
- Evidence metadata.
- Completed AI tasks.

### 2.3 Structured Output

AI assistants must return predictable structured responses.

Use Zod schemas to validate responses before saving them.

### 2.4 Human Approval

AI may:
- Suggest.
- Analyze.
- Summarize.
- Classify provisionally.
- Identify missing information.

AI may not independently:
- Establish authorization.
- Change testing permissions.
- Confirm a vulnerability.
- Approve reportability.
- Submit external reports.
- Execute unrestricted testing.

### 2.5 Provider Independence

The orchestration system should not depend on one AI provider.

Claude is the initial implementation.

Other providers can be added through the same provider interface.

---

## 3. AI Orchestrator

### Responsibilities

The orchestrator coordinates AI activities.

It must:

1. Receive user requests.
2. Identify the requested operation.
3. Validate user permissions.
4. Retrieve investigation context.
5. Identify applicable scope restrictions.
6. Determine whether the task is analysis-only or requires approval.
7. Assign the task.
8. Process the AI response.
9. Validate structured output.
10. Store results.
11. Update task history.
12. Present results to the user.

### Task Classification

Initial supported task types:

- RECON_ANALYSIS
- ATTACK_SURFACE_ANALYSIS
- HYPOTHESIS_GENERATION
- EVIDENCE_REVIEW
- FALSE_POSITIVE_REVIEW
- FINDING_SUMMARY
- REPORT_GENERATION
- SESSION_SUMMARY

The orchestrator should reject unknown task types.

---

## 4. Specialized Assistants

### 4.1 Recon Assistant

Purpose:

Help researchers understand an application's documented structure.

Responsibilities:
- Organize supplied observations.
- Identify known application features.
- Categorize publicly documented routes.
- Record technology information where established.
- Identify missing application context.
- Prepare reconnaissance summaries.

Input:
- Project details.
- Target information.
- Scope documentation.
- User-provided observations.
- Approved passive research notes.

Output:
- Application summary.
- Observed features.
- Known routes.
- Unknown information.
- Research questions.

Restrictions:
- No unrestricted scanning.
- No invented endpoints.
- No assumption that an asset is authorized.
- No active testing without approved capabilities.

### 4.2 Research Assistant

Purpose:

Help users develop and manage security hypotheses.

Responsibilities:
- Analyze documented application behaviour.
- Identify possible security concerns.
- Explain why a hypothesis may be relevant.
- Identify missing information.
- Identify contradictory observations.
- Suggest safe, authorized learning exercises.
- Track previous research.

Input:
- Reconnaissance records.
- Attack surface map.
- Existing hypotheses.
- Investigation history.

Output:
- Hypothesis title.
- Vulnerability category.
- Supporting observations.
- Contradictory observations.
- Missing information.
- Suggested next action.
- Initial priority.

Restrictions:
- No fabricated findings.
- No claims of exploitability without evidence.
- No unrestricted exploitation instructions.
- No duplicate hypothesis generation without justification.

### 4.3 Verification Assistant

Purpose:

Independently challenge proposed vulnerability findings.

This is the most important assistant in the product.

Responsibilities:

- Review available evidence.
- Identify logical inconsistencies.
- Compare expected and observed behaviour.
- Identify missing evidence.
- Identify unsupported impact claims.
- Detect speculative conclusions.
- Identify duplicate findings.
- Recommend a review outcome.

Input:
- Finding details.
- Linked evidence.
- Investigation observations.
- Previous verification reviews.
- Relevant application context.

Output:

- Review summary.
- Supporting evidence.
- Contradictory evidence.
- Missing evidence.
- Reproducibility concerns.
- Impact assessment.
- Recommended conclusion.

Possible conclusions:

- NEEDS_MORE_EVIDENCE.
- NOT_REPRODUCIBLE.
- FALSE_POSITIVE.
- REVIEW_SUPPORTS_CONFIRMATION.

The last result is an AI recommendation, not final human confirmation.

### 4.4 Reporting Assistant

Purpose:

Convert documented findings into clear security reports.

Responsibilities:
- Prepare finding summaries.
- Organize reproduction information.
- Reference supporting evidence.
- Explain documented impact.
- Suggest remediation.
- Identify incomplete report sections.
- Produce Markdown content.

Input:
- Human-approved finding.
- Verification history.
- Evidence references.
- Target context.
- Scope information.

Output:
- Report title.
- Summary.
- Description.
- Affected asset.
- Preconditions.
- Reproduction information.
- Expected behaviour.
- Actual behaviour.
- Impact.
- Remediation.
- Evidence references.

Restrictions:
- Never invent reproduction steps.
- Never fabricate HTTP responses.
- Never exaggerate impact.
- Clearly label missing information.

---

## 5. Context Management System

### Problem

AI assistants frequently lose track of previous work because conversational context is temporary and limited.

Sentinel Research solves this through database-backed investigation memory.

### Context Layers

#### Layer 1: Workspace Context
- User preferences.
- Experience level.
- AI configuration.
- Workspace settings.

#### Layer 2: Project Context
- Project objective.
- Target information.
- Scope.
- Project notes.

#### Layer 3: Investigation Context
- Investigation objective.
- Current status.
- Observations.
- Hypotheses.
- Findings.
- Evidence.
- Previous conclusions.

#### Layer 4: Session Context
- Current conversation.
- Recent AI tasks.
- Current investigation activity.
- Unresolved questions.

### Context Assembly

When a task starts:

1. Retrieve the investigation.
2. Retrieve its project.
3. Retrieve the applicable target.
4. Retrieve the current scope version.
5. Retrieve relevant session summaries.
6. Retrieve existing hypotheses.
7. Retrieve related observations.
8. Retrieve relevant evidence metadata.
9. Retrieve previous task results.
10. Assemble a bounded context package.

Do not send every historical record to the AI on every request.

Use relevance-based retrieval and token budgets.

### Memory Update Rules

Update investigation memory when:
- An investigation is created.
- An observation is recorded.
- A hypothesis changes.
- Evidence is added.
- A verification review completes.
- A human decision is recorded.
- A session ends.

AI-generated summaries must remain identifiable as AI-generated.

Human decisions must be stored separately.

---

## 6. Anti-Hallucination and False-Positive Prevention

### 6.1 Evidence-Based Reasoning

Every AI finding must reference the observations or evidence that support it.

If no supporting evidence exists, the result must remain a hypothesis.

### 6.2 Contradictory Evidence

The verification assistant must actively look for information that weakens the hypothesis.

It should not simply repeat the research assistant's conclusion.

### 6.3 Duplicate Detection

Before generating a hypothesis:
- Retrieve similar existing hypotheses.
- Compare descriptions.
- Compare affected features.
- Compare investigation history.
- Recommend linking or reopening an existing hypothesis where appropriate.

### 6.4 Expected Versus Observed Behaviour

The system should distinguish:

Expected behaviour:
What the application is documented or reasonably established to do.

Observed behaviour:
What the available evidence demonstrates.

Security interpretation:
What the observed difference may mean.

These three concepts must not be treated as interchangeable.

### 6.5 Independent Review

The verification assistant receives the original evidence and hypothesis, not just the research assistant's conclusion.

Where possible, use a different model or a fresh model context.

Independent review does not guarantee correctness.

### 6.6 Confidence Handling

AI confidence may be displayed as an advisory indicator.

It must not automatically:
- Change finding status.
- Establish vulnerability severity.
- Establish exploitability.
- Determine reportability.

---

## 7. AI Task Lifecycle

Every AI task follows this lifecycle:

CREATED
  |
  v
PERMISSION_CHECK
  |
  v
CONTEXT_ASSEMBLY
  |
  v
TASK_ASSIGNMENT
  |
  v
AI_PROCESSING
  |
  v
OUTPUT_VALIDATION
  |
  v
RESULT_STORAGE
  |
  v
HUMAN_REVIEW
  |
  v
COMPLETED

Possible failure states:

- REJECTED.
- FAILED.
- CANCELLED.
- TIMED_OUT.

Every task must preserve:
- Input references.
- Context version.
- Assistant role.
- Provider.
- Model.
- Output.
- Token usage.
- Execution timestamps.
- Failure information.

---

## 8. Prompt Management

Do not place all AI instructions inside route handlers.

Maintain versioned prompt templates.

Suggested structure:

src/
  lib/
    ai/
      providers/
      orchestrator/
      context/
      schemas/
      prompts/
        recon/
          system.md
          task.md
        research/
          system.md
          task.md
        verification/
          system.md
          task.md
        reporting/
          system.md
          task.md

Each prompt should have:
- Version.
- Purpose.
- Input requirements.
- Output schema.
- Safety restrictions.
- Evaluation criteria.

Prompt changes should be versioned so previous AI results remain reproducible.

---

## 9. Provider Architecture

Create a provider abstraction.

Conceptual interface:

AIProvider
  |
  +-- generate()
  |
  +-- generateStructured()
  |
  +-- stream()
  |
  +-- getUsage()
  |
  +-- getStatus()

Initial implementation:

AnthropicProvider

Future implementations:

OpenAIProvider
GoogleProvider
OtherCompatibleProvider

The orchestrator must communicate through the common interface.

Provider-specific configuration must remain isolated.

---

## 10. AI Response Validation

Every specialized assistant must return a structured response.

Validation process:

1. Receive model output.
2. Parse structured content.
3. Validate against the appropriate schema.
4. Check required fields.
5. Validate evidence references.
6. Reject unknown status values.
7. Check output size limits.
8. Store validated results.
9. Request correction or mark the task failed if validation fails.

Never trust a model's assertion that an evidence record exists. Verify referenced IDs against the database.

---

## 11. AI Safety and Permissions

The AI system must use a restricted capability model.

### Allowed by default

- Read authorized project metadata.
- Read relevant investigation records.
- Summarize user-provided evidence.
- Generate hypotheses.
- Review findings.
- Prepare reports.
- Update AI task records.

### Requires explicit human approval

- Modifying scope.
- Enabling a testing integration.
- Creating an external action request.
- Changing a final finding classification.
- Approving reportability.

### Prohibited

- Unrestricted terminal execution.
- Unrestricted browser control.
- Accessing unrelated user data.
- Testing outside approved scope.
- Destructive actions.
- Automatic external report submission.

---

## 12. Cost and Performance Management

Requirements:
- Model selection per task.
- Token usage tracking.
- Maximum task budgets.
- Context truncation.
- Cached stable context where supported.
- Background task execution.
- Retry policies.
- Provider failure handling.

Use lower-cost models for simple classification or summarization where quality evaluation supports it.

Use stronger models for complex evidence analysis where necessary.

Do not make model selection solely based on price.

---

## 13. AI Evaluation Framework

Before releasing an assistant, evaluate it against a controlled dataset.

### Test Categories

1. Correctly supported findings.
2. Unsupported vulnerability claims.
3. Contradictory evidence.
4. Duplicate hypotheses.
5. Missing evidence.
6. Incomplete reports.
7. Malicious instructions inside uploaded evidence.
8. Expired authorization records.
9. Invalid evidence references.
10. Incorrect status transitions.

### Evaluation Metrics

- Evidence citation accuracy.
- Unsupported claim rate.
- Duplicate hypothesis rate.
- Structured output validity.
- Correct uncertainty handling.
- Task completion rate.
- Human reviewer agreement.

Maintain an evaluation dataset so prompt and model changes can be compared.

---

## 14. Recommended Implementation Order

Phase 1:
- Provider abstraction.
- Basic AI conversation.
- Context assembly.
- Persistent messages.

Phase 2:
- Investigation memory.
- Research assistant.
- Structured hypotheses.
- AI task tracking.

Phase 3:
- Verification assistant.
- Evidence references.
- False-positive review.
- Human approval.

Phase 4:
- Reporting assistant.
- Prompt versioning.
- Evaluation framework.
- Additional AI providers.

---

## 15. Architectural Success Criteria

The AI architecture is successful when:

1. AI tasks use the correct investigation context.
2. AI does not invent evidence references.
3. Previous investigation work is preserved.
4. Duplicate research is reduced.
5. AI can explain missing evidence.
6. Verification challenges initial hypotheses.
7. Human decisions remain authoritative.
8. Provider changes do not require rewriting business logic.
9. AI task failures do not corrupt investigations.
10. AI results can be traced to their prompts, model and source records.