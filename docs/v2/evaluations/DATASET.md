# Research quality fixtures — version 1

Status: deterministic engineering fixtures; researcher review and live-model evaluation are outstanding. These checks establish contract behavior, not measured Claude accuracy or reviewer agreement.

| Scenario | Expected decision | Executable fixture |
| --- | --- | --- |
| A claim supported by a selected record | Accept its source identity; retain explicit confidence and limitations | `v2-ai-recovery.test.ts` |
| A loaded record omitted from the actual prompt | Reject its citation | `v2-context-quality.test.ts` |
| A foreign evidence/finding/knowledge identifier | Reject the citation and prevent human adoption | `v2-context-quality.test.ts`, `v2-agent-quality.test.ts` |
| Contradictory supplied observations | Preserve support and contradiction separately; recommendation remains advisory | `v2-agent-quality.test.ts` |
| Ambiguous tool alerts | Keep both originals and explicit duplicate reasons | `v2-imports.test.ts`, `v2-imports-remediation.test.ts` |
| Critical severity supplied by a scanner | Adopt only an unassessed draft; require a human severity decision | `v2-imports-remediation.test.ts` |
| Embedded instructions in a reference or prior analysis | Serialize as untrusted data; no execution tools or permission grants | `v2-agent-quality.test.ts` |
| Unsupported observed claim or invented report source | Reject output/adoption | `v2-agent-quality.test.ts` |
| Missing reproduction or demonstrated impact | Preserve an explicit gap; require human report review | `v2-report-adoption.test.ts` |

Before enabling a new production model or changing prompts, have a researcher review and version the scenarios, run live models using only synthetic/public fixtures, and record model ID, prompt hash, dataset checksum, selected context, output, input/output tokens and review decisions. Measure output validity, citation accuracy, unsupported claims, contradiction handling, uncertainty, retrieval relevance and human agreement separately. Set release thresholds from those measurements. Never describe deterministic contract checks as live-model quality results.
