export type InvestigationFormValues = {
  projectId: string;
  targetId: string;
  title: string;
  description: string;
  objective: string;
  category: string;
};

export type InvestigationFormField = keyof InvestigationFormValues;

export type InvestigationFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<InvestigationFormField, string>>;
  values: InvestigationFormValues;
};

export const EMPTY_INVESTIGATION_FORM_VALUES: InvestigationFormValues = {
  projectId: "",
  targetId: "",
  title: "",
  description: "",
  objective: "",
  category: "",
};

export const INITIAL_INVESTIGATION_FORM_STATE: InvestigationFormState = {
  status: "idle",
  values: EMPTY_INVESTIGATION_FORM_VALUES,
};

export type ObservationFormValues = {
  title: string;
  description: string;
  observationType: string;
  source: string;
  confidenceLabel: string;
};

export type ObservationFormField = keyof ObservationFormValues;

export type ObservationFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ObservationFormField, string>>;
  values: ObservationFormValues;
};

export const EMPTY_OBSERVATION_FORM_VALUES: ObservationFormValues = {
  title: "",
  description: "",
  observationType: "APPLICATION_BEHAVIOUR",
  source: "",
  confidenceLabel: "UNKNOWN",
};

export const INITIAL_OBSERVATION_FORM_STATE: ObservationFormState = {
  status: "idle",
  values: EMPTY_OBSERVATION_FORM_VALUES,
};

export type HypothesisFormValues = {
  title: string;
  description: string;
  vulnerabilityCategory: string;
  missingInformation: string;
  observationLinks: Record<string, string>;
};

export type HypothesisFormField = Exclude<keyof HypothesisFormValues, "observationLinks">;

export type HypothesisFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<HypothesisFormField, string>>;
  values: HypothesisFormValues;
};

export const EMPTY_HYPOTHESIS_FORM_VALUES: HypothesisFormValues = {
  title: "",
  description: "",
  vulnerabilityCategory: "",
  missingInformation: "",
  observationLinks: {},
};

export const INITIAL_HYPOTHESIS_FORM_STATE: HypothesisFormState = {
  status: "idle",
  values: EMPTY_HYPOTHESIS_FORM_VALUES,
};

export type SessionSummaryFormValues = {
  summary: string;
  completedWork: string;
  rejectedHypotheses: string;
  unresolvedQuestions: string;
  nextActions: string;
};

export type SessionSummaryFormField = keyof SessionSummaryFormValues;

export type SessionSummaryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<SessionSummaryFormField, string>>;
  values: SessionSummaryFormValues;
};

export const EMPTY_SESSION_SUMMARY_FORM_VALUES: SessionSummaryFormValues = {
  summary: "",
  completedWork: "",
  rejectedHypotheses: "",
  unresolvedQuestions: "",
  nextActions: "",
};

export const INITIAL_SESSION_SUMMARY_FORM_STATE: SessionSummaryFormState = {
  status: "idle",
  values: EMPTY_SESSION_SUMMARY_FORM_VALUES,
};

export type StatusFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_STATUS_FORM_STATE: StatusFormState = { status: "idle" };
