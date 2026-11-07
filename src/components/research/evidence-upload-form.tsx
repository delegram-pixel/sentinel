"use client";

import { FieldHelpLabel } from "@/components/shared/field-help-label";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ResearchSection } from "@/components/shared/research-section";
import { Field, FieldGroup, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  EVIDENCE_MIME_TYPES,
  EVIDENCE_TYPES,
  EVIDENCE_TYPE_LABELS,
  MAX_EVIDENCE_BYTES,
  type EvidenceMimeType,
  type EvidenceType,
} from "@/modules/evidence/domain/evidence";

const TEXT_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/csv",
  "application/json",
  "application/xml",
  "text/xml",
  "application/x-ndjson",
]);

function isAllowedMime(value: string): value is EvidenceMimeType {
  return (EVIDENCE_MIME_TYPES as readonly string[]).includes(value);
}

function inferMime(file: File): EvidenceMimeType | "" {
  if (isAllowedMime(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "json":
      return "application/json";
    case "xml":
      return "application/xml";
    case "csv":
      return "text/csv";
    case "ndjson":
      return "application/x-ndjson";
    case "txt":
    case "log":
      return "text/plain";
    default:
      return "";
  }
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function EvidenceUploadForm({
  investigationId,
  investigationTitle,
}: {
  investigationId: string;
  investigationTitle: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [mimeType, setMimeType] = useState<EvidenceMimeType | "">("");
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("SCREENSHOT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("");
  const [textContent, setTextContent] = useState<string | null>(null);
  const [redactionConfirmed, setRedactionConfirmed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function handleFileChange(selected: File | null) {
    setFile(selected);
    setTextContent(null);
    setError(null);

    if (!selected) {
      setMimeType("");
      return;
    }

    if (selected.size > MAX_EVIDENCE_BYTES) {
      setError("Evidence files must be 25 MB or smaller.");
    }

    const inferred = inferMime(selected);
    setMimeType(inferred);

    if (inferred && TEXT_MIME_TYPES.has(inferred)) {
      try {
        setTextContent(await selected.text());
      } catch {
        setTextContent(null);
      }
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a file to upload.");
      return;
    }

    if (!mimeType) {
      setError("Choose the file's media type.");
      return;
    }

    if (!redactionConfirmed) {
      setError("Review the file and confirm that sensitive information was removed.");
      return;
    }

    setPending(true);

    try {
      const bytes =
        textContent !== null
          ? new TextEncoder().encode(textContent)
          : new Uint8Array(await file.arrayBuffer());

      if (bytes.byteLength === 0) {
        setError("The file is empty.");
        return;
      }

      if (bytes.byteLength > MAX_EVIDENCE_BYTES) {
        setError("Evidence files must be 25 MB or smaller.");
        return;
      }

      const checksum = await sha256Hex(bytes);
      const response = await fetch("/api/evidence/upload-url", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          investigationId,
          evidenceType,
          title,
          description,
          fileName: file.name,
          mimeType,
          fileSize: bytes.byteLength,
          checksum,
          source,
        }),
      });
      const intent = (await response.json()) as {
        evidenceId?: string;
        uploadUrl?: string;
        error?: string;
      };

      if (!response.ok || !intent.evidenceId || !intent.uploadUrl) {
        setError(intent.error ?? "The upload could not be started.");
        return;
      }

      const upload = await fetch(intent.uploadUrl, {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: bytes,
      });

      if (!upload.ok) {
        setError("The file could not be uploaded. Try again.");
        return;
      }

      const finalize = await fetch(`/api/evidence/${intent.evidenceId}/finalize`, {
        method: "POST",
      });
      const result = (await finalize.json()) as { error?: string };

      if (!finalize.ok) {
        setError(result.error ?? "The upload could not be verified.");
        return;
      }

      router.push(`/dashboard/evidence/${intent.evidenceId}`);
      router.refresh();
    } catch {
      setError("The upload failed unexpectedly. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <ResearchSection
      id="evidence-upload-form"
      title="File and provenance"
      description={
        <>
          Files upload to private quarantine storage for {investigationTitle}. They become available
          to findings and AI context only after a human reviewer resolves redaction.
        </>
      }
    >
      <form onSubmit={handleSubmit} aria-busy={pending} className="form-stack">
        <FieldGroup>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="evidence-file">File</FieldLabel>
              <Input
                id="evidence-file"
                name="file"
                disabled={pending}
                type="file"
                required
                aria-describedby="evidence-file-help"
                accept={EVIDENCE_MIME_TYPES.join(",")}
                onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
              />
              <FieldDescription id="evidence-file-help">
                PNG, JPEG, WebP, PDF, text, CSV, JSON, XML, or NDJSON. Maximum 25 MB.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="evidence-title">Title</FieldLabel>
              <Input
                id="evidence-title"
                name="title"
                disabled={pending}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="evidence-type">Evidence type</FieldLabel>
              <Select
                id="evidence-type"
                name="evidenceType"
                disabled={pending}
                value={evidenceType}
                onChange={(event) => setEvidenceType(event.target.value as EvidenceType)}
              >
                {EVIDENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {EVIDENCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="evidence-mime">Media type</FieldLabel>
              <Select
                id="evidence-mime"
                name="mimeType"
                disabled={pending}
                value={mimeType}
                onChange={(event) => setMimeType(event.target.value as EvidenceMimeType | "")}
                required
              >
                <option value="">Choose a media type</option>
                {EVIDENCE_MIME_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>

            <Field>
              <FieldHelpLabel
                htmlFor="evidence-source"
                help={{
                  description:
                    "Explain where this material originated and how it relates to the investigation. Keep enough provenance for a reviewer to trace the original observation.",
                  example:
                    "A response capture from the local lab, collected during the access-control investigation; record the capture date and collection method in the description.",
                  note: "A filename alone rarely explains who collected the material or what it demonstrates.",
                }}
              >
                Source
              </FieldHelpLabel>
              <Input
                id="evidence-source"
                name="source"
                disabled={pending}
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Tool, request, or external reference"
              />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="evidence-description">Description</FieldLabel>
              <Textarea
                id="evidence-description"
                name="description"
                disabled={pending}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24"
              />
            </Field>
          </FieldGroup>

          {textContent !== null ? (
            <Field>
              <FieldHelpLabel
                htmlFor="evidence-text"
                help={{
                  description:
                    "Review the text that will be uploaded and remove secrets or personal information before confirming the redaction review.",
                  example:
                    "Replace access tokens, session cookies, email addresses, and unnecessary account identifiers while retaining the parts needed to understand the observation.",
                  note: "Upload validation, human evidence approval, and AI-safe review remain separate checks.",
                }}
              >
                Redaction review
              </FieldHelpLabel>
              <Textarea
                id="evidence-text"
                name="textContent"
                disabled={pending}
                value={textContent}
                onChange={(event) => setTextContent(event.target.value)}
                variant="technical"
                className="min-h-48"
              />
              <FieldDescription>
                Remove secrets, tokens, credentials, and personal data. The text above is exactly
                what will be uploaded and scanned by the server.
              </FieldDescription>
            </Field>
          ) : null}

          <label className="flex min-h-11 items-start gap-3 border-l-2 border-warning py-2 pl-4 text-sm">
            <input
              type="checkbox"
              name="redactionConfirmed"
              required
              disabled={pending}
              checked={redactionConfirmed}
              onChange={(event) => setRedactionConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>
              I have reviewed this file and removed or obscured sensitive information. I understand
              that a human reviewer must still approve it before it can support a finding or enter
              AI context.
            </span>
          </label>

          {error ? (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button className="self-start" type="submit" disabled={pending}>
            {pending ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" aria-hidden />
            ) : null}
            {pending ? "Uploading…" : "Upload evidence"}
          </Button>
        </FieldGroup>
      </form>
    </ResearchSection>
  );
}
