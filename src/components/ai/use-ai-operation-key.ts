"use client";
import { useActionState, useRef } from "react";
import type { AiFormState } from "./ai-form-state";
/** One operation ID survives resubmission until a completed action remounts the form. */
export function useAiOperationAction(
  action: (state: AiFormState, data: FormData) => Promise<AiFormState>,
  initialState: AiFormState,
) {
  const operationKey = useRef<string | null>(null);
  return useActionState((state: AiFormState, data: FormData) => {
    operationKey.current ??= crypto.randomUUID();
    data.set("operationKey", operationKey.current);
    return action(state, data);
  }, initialState);
}
