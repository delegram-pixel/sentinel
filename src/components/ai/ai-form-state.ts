export type AiFormState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_AI_FORM_STATE: AiFormState = { status: "idle" };
