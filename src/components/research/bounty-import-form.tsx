"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Sparkles } from "lucide-react";
import {
  importBountyAction,
  cancelBountyImportAction,
} from "@/app/(dashboard)/dashboard/projects/bounty-actions";
import {
  bountyFailureMessage,
  MAX_BOUNTY_TEXT,
  type BountyDraft,
} from "@/modules/bounty/domain/bounty-import";
import { ResearchSection } from "@/components/shared/research-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BountyReviewForm } from "./bounty-review-form";

export function BountyImportForm({ initialJobId }: { initialJobId?: string }) {
  const router = useRouter();
  const [programUrl, setProgramUrl] = useState("");
  const [details, setDetails] = useState("");
  const [readUrl, setReadUrl] = useState(true);
  const [jobId, setJobId] = useState(initialJobId ?? "");
  const [draft, setDraft] = useState<BountyDraft | null>(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(Boolean(initialJobId));
  const [pollKey, setPollKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const reviewRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!jobId || draft || !waiting) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    async function poll() {
      try {
        const response = await fetch(`/api/tasks/${jobId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unavailable");
        const job = await response.json();
        if (controller.signal.aborted) return;
        failures = 0;
        if (job.kind !== "BOUNTY_IMPORT") throw new Error("Unavailable");
        if (job.status === "SUCCEEDED" && job.result?.draft) {
          if (job.result.savedProjectId) {
            router.replace(`/dashboard/projects/${job.result.savedProjectId}`);
            return;
          }
          setDraft(job.result.draft);
          setWaiting(false);
          return;
        }
        if (["FAILED", "CANCELLED"].includes(job.status)) {
          setError(
            job.status === "CANCELLED"
              ? "The import was cancelled. Your input is still here."
              : bountyFailureMessage(job.failureCode),
          );
          setWaiting(false);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        if (++failures >= 3) {
          setError(
            "Could not check the import. Check your connection, then retry checking its status.",
          );
          setWaiting(false);
          return;
        }
      }
      timer = setTimeout(poll, 2000);
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [jobId, draft, waiting, pollKey, router]);

  useEffect(() => {
    if (draft) reviewRef.current?.focus();
  }, [draft]);

  function analyze() {
    setError("");
    startTransition(async () => {
      try {
        const result = await importBountyAction(
          { programUrl, details, readUrl },
          crypto.randomUUID(),
        );
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setJobId(result.value.id);
        setWaiting(true);
        router.replace(`/dashboard/projects/new?import=${result.value.id}`, { scroll: false });
      } catch {
        setError("The import could not be started. Your input is still here; try again.");
      }
    });
  }

  if (draft)
    return (
      <div className="form-stack">
        <h2 ref={reviewRef} tabIndex={-1} className="section-title">
          Review imported bounty
        </h2>
        <BountyReviewForm key={jobId} draft={draft} importJobId={jobId} />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(null);
            setJobId("");
            setError("");
            router.replace("/dashboard/projects/new", { scroll: false });
          }}
        >
          Start another import
        </Button>
      </div>
    );

  return (
    <form
      className="form-stack"
      aria-busy={pending || waiting}
      onSubmit={(event) => {
        event.preventDefault();
        analyze();
      }}
    >
      <ResearchSection
        id="bounty-import"
        title="Import bounty with AI"
        description="Paste the program URL and any details you have. AI will suggest project, target, and scope fields for you to review."
      >
        <FieldGroup>
          <Field>
            <Label htmlFor="bounty-program-url">Program URL</Label>
            <Input
              id="bounty-program-url"
              type="url"
              maxLength={500}
              value={programUrl}
              onChange={(event) => setProgramUrl(event.target.value)}
              placeholder="https://hackerone.com/example"
              disabled={pending || waiting}
              aria-describedby="bounty-url-hint"
            />
            <p id="bounty-url-hint" className="text-xs text-muted-foreground">
              Use the page containing the program policy and scope. Private programs can use pasted
              text.
            </p>
          </Field>
          <Field orientation="horizontal">
            <input
              id="bounty-read-url"
              type="checkbox"
              checked={readUrl}
              onChange={(event) => setReadUrl(event.target.checked)}
              disabled={pending || waiting}
              className="size-4 accent-primary"
            />
            <Label htmlFor="bounty-read-url" className="font-normal">
              Read program URL
            </Label>
          </Field>
          <Field>
            <Label htmlFor="bounty-details">Program details</Label>
            <Textarea
              id="bounty-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={8}
              maxLength={MAX_BOUNTY_TEXT}
              disabled={pending || waiting}
              placeholder="Paste the policy, in-scope assets, exclusions, restrictions, and any extra context…"
              aria-describedby="bounty-details-hint"
            />
            <p id="bounty-details-hint" className="text-xs text-muted-foreground">
              This text goes to your configured AI provider. Leave out credentials and personal
              data.
            </p>
          </Field>
        </FieldGroup>
      </ResearchSection>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {waiting ? (
        <Alert role="status">
          <LoaderCircle className="animate-spin" aria-hidden />
          <AlertDescription>
            Reading and analyzing the bounty. You can keep this page open; the research worker will
            return the results here.
          </AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending || waiting}>
          {pending || waiting ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
          ) : (
            <Sparkles data-icon="inline-start" aria-hidden />
          )}
          {pending ? "Starting import…" : waiting ? "Analyzing bounty…" : "Analyze bounty"}
        </Button>
        {waiting ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  const result = await cancelBountyImportAction(jobId);
                  if (!result.ok || !result.value) {
                    setError(
                      "The import could not be cancelled. Check its status, then try again.",
                    );
                    return;
                  }
                  setWaiting(false);
                  setError("The import was cancelled. Your input is still here.");
                } catch {
                  setError("Could not cancel the import. Try again.");
                }
              })
            }
          >
            Cancel import
          </Button>
        ) : null}
        {jobId && error && !waiting ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError("");
              setWaiting(true);
              setPollKey((value) => value + 1);
            }}
          >
            Check import status
          </Button>
        ) : null}
      </div>
    </form>
  );
}
