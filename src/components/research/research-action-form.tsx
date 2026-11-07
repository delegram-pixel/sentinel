"use client";

import { useActionState, useId } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldHelpLabel } from "@/components/shared/field-help-label";

export type ResearchFormState = { status: "idle" | "success" | "error"; message?: string };
export type ResearchField = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "date" | "datetime-local" | "url" | "file";
  accept?: string;
  required?: boolean;
  maxLength?: number;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
  help?: string;
};
export function ResearchActionForm({
  action,
  fields,
  hidden,
  submitLabel,
}: {
  action: (state: ResearchFormState, data: FormData) => Promise<ResearchFormState>;
  fields: ResearchField[];
  hidden?: Record<string, string>;
  submitLabel: string;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return (
    <form action={formAction} className="form-stack" aria-busy={pending}>
      {Object.entries(hidden ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          <AlertDescription role="status">{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {fields.map((field) => (
        <div className="grid gap-2" key={field.name}>
          {field.help ? (
            <FieldHelpLabel htmlFor={`${id}-${field.name}`} help={{ description: field.help }}>
              {field.label}
            </FieldHelpLabel>
          ) : (
            <Label htmlFor={`${id}-${field.name}`}>{field.label}</Label>
          )}
          {field.options ? (
            <Select
              id={`${id}-${field.name}`}
              name={field.name}
              required={field.required}
              defaultValue={field.defaultValue}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : field.type === "textarea" ? (
            <Textarea
              id={`${id}-${field.name}`}
              name={field.name}
              required={field.required}
              maxLength={field.maxLength}
              defaultValue={field.defaultValue}
              rows={5}
            />
          ) : (
            <Input
              id={`${id}-${field.name}`}
              name={field.name}
              type={field.type ?? "text"}
              accept={field.accept}
              required={field.required}
              maxLength={field.maxLength}
              defaultValue={field.defaultValue}
            />
          )}
          {field.help ? <p className="text-xs text-muted-foreground">{field.help}</p> : null}
        </div>
      ))}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
