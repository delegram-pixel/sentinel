export const CHUNK_PROCESSING_VERSION = "sentinel-text-v1";
/** Offsets refer to the unmodified source, so a reviewer can inspect each exact quote. */
export function chunkDocument(content: string, size = 2400) {
  if (size < 256 || size > 10000) throw new Error("Invalid chunk size.");
  const chunks = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(start + size, content.length);
    if (end < content.length) {
      const newline = content.lastIndexOf("\n", end);
      if (newline > start + size / 2) end = newline + 1;
    }
    const text = content.slice(start, end);
    chunks.push({
      sequence: chunks.length,
      startOffset: start,
      endOffset: end,
      content: text,
      processingVersion: CHUNK_PROCESSING_VERSION,
    });
    start = end;
  }
  return chunks;
}
