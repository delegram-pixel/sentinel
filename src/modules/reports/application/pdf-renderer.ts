import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * Deterministic Markdown-to-PDF renderer for approved report revisions
 * (ADR-027). It runs in-process, never calls AI, and renders the exact Markdown
 * that was saved in the report revision. The canonical export remains Markdown.
 */

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 52;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

type FontFamily = "body" | "bold" | "mono";

type FontSet = {
  body: PDFFont;
  bold: PDFFont;
  mono: PDFFont;
};

type TextOptions = {
  font?: FontFamily;
  size?: number;
  indent?: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
  spaceBefore?: number;
  spaceAfter?: number;
};

function sanitizeForPdf(value: string): string {
  return value
    .replaceAll("\u2013", "-")
    .replaceAll("\u2014", "-")
    .replaceAll("\u2018", "'")
    .replaceAll("\u2019", "'")
    .replaceAll("\u201C", '"')
    .replaceAll("\u201D", '"')
    .replaceAll("\u2026", "...")
    .replaceAll("\u2022", "-")
    .replaceAll("\u00A0", " ")
    .replaceAll("\t", "  ")
    .replace(/[^\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}

function stripInlineMarkdown(value: string): string {
  return sanitizeForPdf(
    value
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1"),
  );
}

function splitLongToken(token: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const pieces: string[] = [];
  let current = "";

  for (const character of token) {
    const candidate = `${current}${character}`;

    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      pieces.push(current);
      current = character;
    } else {
      current = candidate;
    }
  }

  if (current) {
    pieces.push(current);
  }

  return pieces;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const token of normalized.split(" ")) {
    const candidate = current ? `${current} ${token}` : token;

    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }

    if (current) {
      lines.push(current);
    }

    if (font.widthOfTextAtSize(token, size) > maxWidth) {
      const pieces = splitLongToken(token, font, size, maxWidth);
      const last = pieces.pop();

      lines.push(...pieces);
      current = last ?? "";
    } else {
      current = token;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

class MarkdownPdfRenderer {
  private readonly pages: PDFPage[] = [];
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN_TOP;

  constructor(
    private readonly document: PDFDocument,
    private readonly fonts: FontSet,
  ) {
    this.page = this.addPage();
  }

  private addPage(): PDFPage {
    const page = this.document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push(page);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
    return page;
  }

  private ensureSpace(height: number): void {
    if (this.y - height >= MARGIN_BOTTOM) {
      return;
    }

    this.newPage();
  }

  private newPage(): void {
    this.page = this.addPage();
  }

  private selectFont(font: FontFamily): PDFFont {
    if (font === "bold") {
      return this.fonts.bold;
    }

    if (font === "mono") {
      return this.fonts.mono;
    }

    return this.fonts.body;
  }

  addText(text: string, options: TextOptions = {}): void {
    const fontName = options.font ?? "body";
    const font = this.selectFont(fontName);
    const size = options.size ?? 10.5;
    const indent = options.indent ?? 0;
    const lineHeight = options.lineHeight ?? size * 1.45;
    const color = options.color ?? rgb(0.12, 0.12, 0.12);
    const maxWidth = CONTENT_WIDTH - indent;

    const content = fontName === "mono" ? sanitizeForPdf(text) : stripInlineMarkdown(text);
    const wrapped = wrapText(content, font, size, maxWidth);

    if (wrapped.length === 0) {
      return;
    }

    this.y -= options.spaceBefore ?? 0;
    const blockHeight = wrapped.length * lineHeight + (options.spaceAfter ?? 0);

    this.ensureSpace(blockHeight);

    for (const line of wrapped) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN_X + indent,
        y: this.y - size,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }

    this.y -= options.spaceAfter ?? 0;
  }

  addRule(spaceBefore = 4, spaceAfter = 10): void {
    this.y -= spaceBefore;
    this.ensureSpace(1);
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    this.y -= spaceAfter;
  }

  addPageFooters(title: string): void {
    const total = this.pages.length;

    this.pages.forEach((page, index) => {
      page.drawText(sanitizeForPdf(title), {
        x: MARGIN_X,
        y: 26,
        size: 7.5,
        font: this.fonts.body,
        color: rgb(0.45, 0.45, 0.45),
      });
      const label = `Page ${index + 1} of ${total}`;
      const width = this.fonts.body.widthOfTextAtSize(label, 7.5);
      page.drawText(label, {
        x: PAGE_WIDTH - MARGIN_X - width,
        y: 26,
        size: 7.5,
        font: this.fonts.body,
        color: rgb(0.45, 0.45, 0.45),
      });
    });
  }

  finish(): void {
    this.addPageFooters(this.document.getTitle() ?? "Sentinel Research report");
  }
}

function renderLine(renderer: MarkdownPdfRenderer, line: string): void {
  if (!line.trim()) {
    renderer.addText("", { spaceAfter: 4 });
    return;
  }

  const heading = /^(#{1,4})\s+(.*)$/.exec(line);

  if (heading) {
    const level = heading[1]?.length ?? 1;
    const text = heading[2] ?? "";
    const sizes: Record<number, number> = { 1: 19, 2: 14.5, 3: 12, 4: 10.5 };

    renderer.addText(text, {
      font: "bold",
      size: sizes[level],
      spaceBefore: level === 1 ? 0 : 10,
      spaceAfter: level === 1 ? 8 : 5,
      lineHeight: (sizes[level] ?? 12) * 1.3,
    });
    return;
  }

  if (line.startsWith("> ")) {
    renderer.addText(line.slice(2), {
      size: 9.5,
      indent: 12,
      spaceAfter: 6,
      color: rgb(0.3, 0.3, 0.3),
    });
    return;
  }

  if (/^---+$/.test(line.trim())) {
    renderer.addRule();
    return;
  }

  const bullet = /^-\s+(.*)$/.exec(line);

  if (bullet) {
    renderer.addText(`- ${bullet[1] ?? ""}`, { indent: 12, spaceAfter: 1 });
    return;
  }

  const numbered = /^(\d+)\.\s+(.*)$/.exec(line);

  if (numbered) {
    renderer.addText(`${numbered[1]}. ${numbered[2] ?? ""}`, { indent: 12, spaceAfter: 1 });
    return;
  }

  renderer.addText(line, { spaceAfter: 3 });
}

export async function renderReportPdf(markdown: string, title?: string): Promise<Uint8Array> {
  const document = await PDFDocument.create();
  const fonts: FontSet = {
    body: await document.embedFont(StandardFonts.Helvetica),
    bold: await document.embedFont(StandardFonts.HelveticaBold),
    mono: await document.embedFont(StandardFonts.Courier),
  };

  document.setTitle(title ?? "Sentinel Research report");
  document.setAuthor("Sentinel Research");
  document.setSubject("Approved research report");

  const renderer = new MarkdownPdfRenderer(document, fonts);
  const lines = markdown.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      renderer.addText("", { spaceAfter: 2 });
      continue;
    }

    if (inCodeBlock) {
      renderer.addText(line, { font: "mono", size: 8.5, spaceAfter: 1 });
      continue;
    }

    renderLine(renderer, line);
  }

  renderer.finish();

  return document.save();
}
