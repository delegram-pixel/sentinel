export type ReportCreateFormValues = {
  title: string;
  templateId: string;
  findingIds: string[];
};

export type ReportCreateFormField = keyof ReportCreateFormValues;

export type ReportCreateFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ReportCreateFormField, string>>;
  values: ReportCreateFormValues;
};

export const EMPTY_REPORT_CREATE_FORM_VALUES: ReportCreateFormValues = {
  title: "",
  templateId: "",
  findingIds: [],
};

export const INITIAL_REPORT_CREATE_FORM_STATE: ReportCreateFormState = {
  status: "idle",
  values: EMPTY_REPORT_CREATE_FORM_VALUES,
};

export type ReportContentFormState = {
  status: "idle" | "error";
  message?: string;
  values: { content: string };
};

export const INITIAL_REPORT_CONTENT_FORM_STATE: ReportContentFormState = {
  status: "idle",
  values: { content: "" },
};

export type ReportStatusFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_REPORT_STATUS_FORM_STATE: ReportStatusFormState = { status: "idle" };

export type ReportTemplateFormValues = {
  name: string;
  sectionIds: string[];
};

export type ReportTemplateFormField = keyof ReportTemplateFormValues;

export type ReportTemplateFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ReportTemplateFormField, string>>;
  values: ReportTemplateFormValues;
};

export const INITIAL_REPORT_TEMPLATE_FORM_STATE: ReportTemplateFormState = {
  status: "idle",
  values: { name: "", sectionIds: [] },
};
