export type FindingFormValues = {
  title: string;
  description: string;
  vulnerabilityCategory: string;
  hypothesisId: string;
  affectedAsset: string;
  affectedAssetType: string;
  impact: string;
  remediation: string;
};

export type FindingFormField = keyof FindingFormValues;

export type FindingFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<FindingFormField, string>>;
  values: FindingFormValues;
};

export const EMPTY_FINDING_FORM_VALUES: FindingFormValues = {
  title: "",
  description: "",
  vulnerabilityCategory: "",
  hypothesisId: "",
  affectedAsset: "",
  affectedAssetType: "",
  impact: "",
  remediation: "",
};

export const INITIAL_FINDING_FORM_STATE: FindingFormState = {
  status: "idle",
  values: EMPTY_FINDING_FORM_VALUES,
};

export type SeverityFormValues = {
  severity: string;
  severityRationale: string;
  affectedAsset: string;
  affectedAssetType: string;
};

export type SeverityFormField = keyof SeverityFormValues;

export type SeverityFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<SeverityFormField, string>>;
  values: SeverityFormValues;
};

export const INITIAL_SEVERITY_FORM_STATE: SeverityFormState = {
  status: "idle",
  values: {
    severity: "UNASSESSED",
    severityRationale: "",
    affectedAsset: "",
    affectedAssetType: "",
  },
};

export type ReviewFormValues = {
  conclusion: string;
  supportingEvidence: string;
  contradictingEvidence: string;
  missingEvidence: string;
  impactAssessment: string;
  reasoningSummary: string;
  resolutionReason: string;
};

export type ReviewFormField = keyof ReviewFormValues;

export type ReviewFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ReviewFormField, string>>;
  values: ReviewFormValues;
};

export const INITIAL_REVIEW_FORM_STATE: ReviewFormState = {
  status: "idle",
  values: {
    conclusion: "NEEDS_MORE_EVIDENCE",
    supportingEvidence: "",
    contradictingEvidence: "",
    missingEvidence: "",
    impactAssessment: "",
    reasoningSummary: "",
    resolutionReason: "",
  },
};

export type Phase6StatusFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_PHASE6_STATUS_FORM_STATE: Phase6StatusFormState = { status: "idle" };

export type EvidenceMetadataFormValues = {
  title: string;
  description: string;
  evidenceType: string;
  source: string;
};

export type EvidenceMetadataFormField = keyof EvidenceMetadataFormValues;

export type EvidenceMetadataFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<EvidenceMetadataFormField, string>>;
  values: EvidenceMetadataFormValues;
};

export const INITIAL_EVIDENCE_METADATA_FORM_STATE: EvidenceMetadataFormState = {
  status: "idle",
  values: { title: "", description: "", evidenceType: "SCREENSHOT", source: "" },
};

export type RedactionReviewFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_REDACTION_REVIEW_FORM_STATE: RedactionReviewFormState = {
  status: "idle",
};

export type EvidenceLinkFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_EVIDENCE_LINK_FORM_STATE: EvidenceLinkFormState = { status: "idle" };
