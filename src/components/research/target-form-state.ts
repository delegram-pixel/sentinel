export type TargetFormValues = {
  name: string;
  description: string;
  assetIdentifier: string;
  assetType: string;
  environmentType: string;
  programName: string;
  programUrl: string;
  authorizationSource: string;
  authorizationDate: string;
  authorizationNotes: string;
};

export type TargetFormField = keyof TargetFormValues;

export type TargetFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<TargetFormField, string>>;
  values: TargetFormValues;
};

export const EMPTY_TARGET_FORM_VALUES: TargetFormValues = {
  name: "",
  description: "",
  assetIdentifier: "",
  assetType: "DOMAIN",
  environmentType: "PRACTICE_LAB",
  programName: "",
  programUrl: "",
  authorizationSource: "",
  authorizationDate: "",
  authorizationNotes: "",
};

export const INITIAL_TARGET_FORM_STATE: TargetFormState = {
  status: "idle",
  values: EMPTY_TARGET_FORM_VALUES,
};
