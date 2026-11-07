import { ResearchOperationError } from "@/modules/shared/domain/result";

export function assertEvidenceRelationshipMutable(finding: {
  status: string;
  investigationStatus: string;
  projectStatus: string;
}) {
  if (finding.investigationStatus === "ARCHIVED" || finding.projectStatus === "ARCHIVED")
    throw new ResearchOperationError(
      "ARCHIVED",
      "Evidence relationships in archived research cannot be changed.",
    );
  if (finding.status === "CLOSED")
    throw new ResearchOperationError(
      "FINDING_CLOSED",
      "Evidence relationships for a closed finding cannot be changed.",
    );
}

export function assertEvidenceUnlinkAllowed(
  findingStatus: string,
  relationship: string,
  otherSupportCount: number,
) {
  if (
    ["CONFIRMED", "REPORTABLE"].includes(findingStatus) &&
    relationship === "SUPPORTS" &&
    otherSupportCount === 0
  )
    throw new ResearchOperationError(
      "REVIEW_REQUIRED",
      "The last supporting evidence cannot be removed from an approved finding. Record a new human review first.",
    );
}
