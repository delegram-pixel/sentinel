const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value);
}

/** Render a nullable date without leaking "Invalid Date" into the UI. */
export function formatOptionalDate(value: Date | null): string {
  return value ? formatDate(value) : "—";
}

/** `YYYY-MM-DD` for a date input, using UTC like the domain validators. */
export function toDateInputValue(value: Date | null): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 10);
}
const fileSizeFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${fileSizeFormatter.format(bytes)} B`;
  if (bytes < 1024 * 1024) return `${fileSizeFormatter.format(bytes / 1024)} KiB`;
  return `${fileSizeFormatter.format(bytes / (1024 * 1024))} MiB`;
}
