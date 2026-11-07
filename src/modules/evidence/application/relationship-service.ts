import { researchOperation } from "@/modules/shared/application/actor";
import { failure, type DomainResult } from "@/modules/shared/domain/result";

/** Both V1 presentation paths use this result contract and the canonical store mutation. */
export async function removeResearchEvidenceLink(
  remove: () => Promise<boolean>,
): Promise<DomainResult<true>> {
  const result = await researchOperation(remove);
  if (!result.ok) return result;
  return result.value
    ? { ok: true, value: true }
    : failure("EVIDENCE_LINK_NOT_FOUND", "That evidence link does not exist.");
}
