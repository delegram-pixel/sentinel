"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChoiceCardOption<T extends string> = {
  value: T;
  label: string;
  description: ReactNode;
  example?: string;
};

type ChoiceCardsProps<T extends string> = {
  name: string;
  legend: string;
  description?: ReactNode;
  hintId: string;
  describedBy?: string;
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<ChoiceCardOption<T>>;
  invalid?: boolean;
  className?: string;
};

/**
 * A compact radio-card group for choices that need a visible explanation.
 * The native radio input remains the accessible control and form value.
 */
export function ChoiceCards<T extends string>({
  name,
  legend,
  description,
  hintId,
  describedBy,
  value,
  onChange,
  options,
  invalid = false,
  className,
}: ChoiceCardsProps<T>) {
  return (
    <fieldset
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy ?? hintId}
      className={cn("flex min-w-0 flex-col gap-2", className)}
    >
      <legend className="text-[13px] leading-5 font-medium">{legend}</legend>
      {description ? (
        <p id={hintId} className="text-xs leading-relaxed text-text-secondary">
          {description}
        </p>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <label
              key={option.value}
              className={cn(
                "flex min-w-0 cursor-pointer items-start gap-3 rounded-sm border bg-surface-elevated p-3 transition-colors",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-input hover:border-text-secondary",
                invalid && !selected ? "border-destructive" : null,
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                  {option.description}
                </span>
                {option.example ? (
                  <span className="mt-1 block text-xs leading-relaxed text-text-secondary">
                    <span className="font-medium text-foreground">Example:</span> {option.example}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
