export type ProjectFormValues = {
  name: string;
  description: string;
  projectType: string;
};

export type ProjectFormField = keyof ProjectFormValues;

export type ProjectFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ProjectFormField, string>>;
  values: ProjectFormValues;
};

export type ArchiveProjectState = {
  status: "idle" | "error";
  message?: string;
};

export const EMPTY_PROJECT_FORM_VALUES: ProjectFormValues = {
  name: "",
  description: "",
  projectType: "LEARNING_LAB",
};

export const INITIAL_PROJECT_FORM_STATE: ProjectFormState = {
  status: "idle",
  values: EMPTY_PROJECT_FORM_VALUES,
};

export const INITIAL_ARCHIVE_PROJECT_STATE: ArchiveProjectState = {
  status: "idle",
};
