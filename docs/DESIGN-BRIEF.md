# Sentinel Research — UI/UX Design Brief

**Version:** 2.0  
**Design direction:** Editorial Research Console  
**Status:** Approved on 6 November 2026; ADR-026  
**Platform:** Desktop-first responsive web application

## Purpose

Sentinel Research is a professional instrument for structured security research. Swiss alignment,
editorial typography, technical publishing, and forensic workstations inform its visual identity.
The interface must distinguish observations, hypotheses, original evidence, AI interpretations, and
human decisions. Research continuity and traceability take precedence over decorative statistics.

## Visual system

| Role | Value | Use |
| --- | --- | --- |
| Background | `#F4F2EC` | Application canvas |
| Main surface | `#FBFAF7` | Navigation and research surfaces |
| Elevated surface | `#FFFFFF` | Inputs and overlays |
| Primary text | `#191B1E` | Records, headings, controls |
| Secondary text on paper | `#666A70` | Small supporting text |
| Supplied secondary tone | `#73777C` | Suitable text on white |
| Structural border | `#DCDAD3` | Section and table rules |
| Control border | `#85898F` | Identifiable input boundaries |
| Primary accent | `#3659A8` | Actions, focus, active navigation |
| Success | `#3F6B52` | Meaningful positive outcomes |
| Warning | `#806027` | Attention and review |
| Danger | `#9A4945` | Errors, revocation, destructive actions |

The supplied secondary tone has approximately 4.03:1 contrast on the canvas and 4.32:1 on the main
surface. Small secondary text uses the approved darker tone. Structural dividers are distinct from
stronger control boundaries. Colours live in `src/app/globals.css`.

### Typography and geometry

- Source Serif 4: regular page and investigation headings, about 40–44px desktop and 30–32px mobile.
- Inter: existing interface family; body, navigation, labels, controls, and record titles at 14–16px.
- JetBrains Mono: existing technical family; IDs, asset names, timestamps, references, and machine
  metadata, normally 12px or larger.
- Use Next.js font optimization and self-host fonts at runtime.
- Use a 4px spacing scale, 24–32px section spacing, precise grids, and aligned information.
- Controls use 2–4px corners. Research records use open layouts and 1px dividers.
- Standard pages have an approximately 1280px measure; the investigation workbench may expand.
- Reserve elevation for overlays. Avoid excessive icons, pills, metric cards, all-caps eyebrows,
  gradients, glow, decorative parallax, and constant animation.
- User-triggered transitions last around 120–180ms and respect reduced motion.

## Application shell

Preserve existing routes and these text-led groups:

- Workspace: Dashboard, Projects, Investigations.
- Research: Targets, Findings, Evidence, Reports.
- Account: Settings.

Use an approximately 224px sidebar and 56px header. Active routes have a narrow cobalt rule and
stronger text. The wordmark is typographic; utility icons remain minimal. Project-scoped target and
investigation routes indicate their corresponding research section.

The header holds breadcrumbs, actual workspace context, and the account menu. Authorization is
shown beside its target or investigation, not as a permanent global status pill. Mobile navigation
uses a titled drawer with focus trapping, Escape, focus restoration, and background scroll locking.

## Dashboard

Keep Dashboard in navigation and use Research overview as the page heading.

```text
Research overview                              Contextual primary action
────────────────────────────────────────────────────────────────────────
Recent investigations — wider column           Requires attention
Title, target, lifecycle, updated                Project setup / scope
Continue an investigation                      Findings awaiting validation
────────────────────────────────────────────────────────────────────────
Recent research activity                       Next actions
Recorded audit events                          Saved session continuity
────────────────────────────────────────────────────────────────────────
Evidence activity or its explicit availability state
```

Compose existing project, target, investigation, workspace-overview, and audit contracts. Counts
support their relevant sections. Show saved next actions only when available; never infer tasks or
completion percentages. The existing NEEDS_VALIDATION count is not an implemented human-review queue.
An empty workspace leads with Create project, then explains registration and investigation setup.

## Research pages

- Projects become a registry with title, type, lifecycle, targets, investigations, and update date.
  Details use open metadata, targets, and investigation links.
- Targets and scopes use structured asset records, authorization, effective dates, allowed/excluded
  assets, and version history. Authorization remains self-attested; active scope is authoritative.
- Investigations use a persistent context rail beside the research document. Keep objectives,
  observations, hypotheses, missing information, and session continuity easy to find. Assistance
  expands into a separate panel on wide screens and a drawer below that.
- Findings are structured records with affected target, severity, verification, references,
  confidence, and review history. Missing assessments remain missing; confidence is not verification.
- Evidence has actual IDs, source, type, timestamps, integrity, version, redaction state, and typed
  relationships. Original evidence is immutable and is never confused with interpretation.
- Reports use a document-oriented composition with investigation context and revision provenance.
- Settings uses aligned account/workspace information followed by audit history.

Distinguish empty data, unimplemented features, loading, inaccessible records, and errors. A visual
redesign does not implement finding, evidence, report, or AI backends. Never simulate their data,
uploads, exports, provider responses, verification, or metrics.

## AI assistance

The assistant belongs to the investigation. Guided Mode centres on contextual questions and
reviewable explanations. Delegated Mode centres on a bounded task brief, task history, structured
results, and review actions. Clearly show the selected mode.

Label AI interpretations explicitly and show review status. Structured output groups interpretations,
hypotheses, supporting/contradicting references, missing evidence, and next actions. Display actual
source IDs and available model/task provenance. Only a human can confirm findings or reportability.
No provider selector or credential entry is added; ADR-025 governs the MVP provider surface.

## Components and verification

Build PageHeader, ResearchSection, RecordTable, MetadataList, StatusLabel, SourceLabel,
EvidenceReference, and ResearchOutput. Extend existing controls without changing working form
contracts. Use the installed Radix primitives for accessible drawers and mode controls. Static
records and data loading remain server-rendered.

Implement tokens and typography, controls, the shell, main pages, then the assistant interface.
Verify pages incrementally. Preserve models, API and Server Action contracts, access checks, scope
checks, domain transitions, immutable evidence, human authority, and working backend functionality.

Target WCAG 2.2 AA: contrast, visible focus, keyboard access, accessible names, touch targets, zoom,
reflow, responsive tables, and reduced motion. Check empty/loading/error/archived/unavailable states
and relevant creation/editing/lifecycle/navigation flows without live targets or model calls.

Required checks: formatting, lint, typecheck, unit tests, production build, and Playwright for shell
changes. Signed-in runtime checks require a development login. Isolated visual checks must not
weaken production authentication or persist invented research records.
