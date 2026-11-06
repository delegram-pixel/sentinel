"use client";

import { useEffect, useRef } from "react";

/** Move keyboard focus to the field rejected by a Server Action. */
export function useFormErrorFocus(result: { status: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result.status !== "error") return;

    const form = formRef.current;
    const target =
      form?.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      form?.querySelector<HTMLElement>('[role="alert"]');

    if (target) {
      if (!target.matches("input, textarea, select, button")) target.tabIndex = -1;
      target.focus();
    }
  }, [result]);

  return formRef;
}
