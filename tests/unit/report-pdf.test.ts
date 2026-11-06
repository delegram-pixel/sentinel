import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { renderReportPdf } from "@/modules/reports/application/pdf-renderer";

describe("report PDF rendering", () => {
  it("renders the canonical Markdown into a PDF document", async () => {
    const pdf = await renderReportPdf(
      [
        "# Search review",
        "",
        "**Project:** Local Lab",
        "",
        "> This report includes only confirmed findings.",
        "",
        "## Summary",
        "",
        "This report documents 1 finding.",
        "",
        "## Findings",
        "",
        "### 1. Reflected input",
        "",
        "- **Severity:** High",
        "- **Status:** confirmed",
        "",
        "```",
        "GET /search?q=<script>",
        "```",
      ].join("\n"),
      "Search review",
    );

    const document = await PDFDocument.load(pdf);

    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(pdf).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(document.getTitle()).toBe("Search review");
    expect(document.getAuthor()).toBe("Sentinel Research");
    expect(document.getPageCount()).toBe(1);
  });

  it("wraps long content across multiple pages", async () => {
    const body = Array.from(
      { length: 120 },
      (_, index) => `Finding ${index + 1} contains a long description for wrapping and pagination.`,
    ).join("\n\n");
    const pdf = await renderReportPdf(`# Long report\n\n${body}`);
    const document = await PDFDocument.load(pdf);

    expect(document.getPageCount()).toBeGreaterThan(1);
  });
});
