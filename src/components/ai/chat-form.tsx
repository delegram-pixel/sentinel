"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

type StreamEvent =
  | { type: "start"; conversationId: string }
  | { type: "complete"; conversationId: string; taskId: string; messageId: string }
  | { type: "error"; code: string; message: string };

function parseEvent(chunk: string): StreamEvent | null {
  const dataLine = chunk.split("\n").find((line) => line.trimStart().startsWith("data:"));

  if (!dataLine) {
    return null;
  }

  try {
    return JSON.parse(dataLine.replace(/^\s*data:\s*/, "")) as StreamEvent;
  } catch {
    return null;
  }
}

export function ChatForm({
  investigationId,
  conversationId,
  disabled,
}: {
  investigationId: string;
  conversationId: string;
  disabled: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const operation = useRef<{ message: string; key: string; conversationId: string } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!message.trim() || pending || disabled) {
      return;
    }

    setPending(true);
    setError(null);
    if (
      operation.current?.message !== message ||
      operation.current.conversationId !== conversationId
    )
      operation.current = { message, key: crypto.randomUUID(), conversationId };

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          investigationId,
          conversationId,
          message,
          operationKey: operation.current.key,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "The chat request could not be sent.");
        return;
      }

      if (!response.body) {
        setError("The chat response was empty.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let failed = false;
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const event = parseEvent(chunk);

          if (!event) {
            continue;
          }

          if (event.type === "error") {
            setError(event.message);
            failed = true;
          }
          if (event.type === "complete") completed = true;
        }
      }

      if (!failed && completed) {
        setMessage("");
        operation.current = null;
      } else if (!failed) {
        setError("The stream ended before completion. Check task history or retry this question.");
      }
    } catch {
      setError("The chat request could not be completed.");
    } finally {
      setPending(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-busy={pending}>
      <FieldGroup>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field data-disabled={disabled || pending}>
          <FieldLabel htmlFor={id}>Research question</FieldLabel>
          <Textarea
            id={id}
            name="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={8_000}
            disabled={disabled || pending}
            placeholder="What do the recorded observations support, and what should we verify next?"
            aria-describedby={`${id}-hint`}
          />
          <FieldDescription id={`${id}-hint`}>
            The assistant uses saved investigation context. Review its interpretation before
            recording a conclusion.
          </FieldDescription>
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={disabled || pending || !message.trim()}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Analysing…" : "Ask assistant"}
          </Button>
          <span role="status" className="text-xs text-text-secondary">
            {pending ? "Analysis is running. Your question has been sent." : ""}
          </span>
        </div>
      </FieldGroup>
    </form>
  );
}
