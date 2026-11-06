export type ScopeDraftField =
  "effectiveFrom" | "effectiveUntil" | "assets" | "permittedActivities" | "attestationNotes";

export type ScopeDraftFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ScopeDraftField, string>>;
};

export type ScopeActivationField =
  "authorizationSource" | "authorizationDate" | "attestationNotes" | "acknowledged";

export type ScopeActivationFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<ScopeActivationField, string>>;
};

export type ScopeRevokeState = {
  status: "idle" | "error";
  message?: string;
};

export const INITIAL_SCOPE_DRAFT_STATE: ScopeDraftFormState = { status: "idle" };

export const INITIAL_SCOPE_ACTIVATION_STATE: ScopeActivationFormState = { status: "idle" };

export const INITIAL_SCOPE_REVOKE_STATE: ScopeRevokeState = { status: "idle" };
