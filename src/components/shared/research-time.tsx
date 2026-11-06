const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function ResearchTime({
  date,
  precision = "day",
  empty = "Not recorded",
}: {
  date: Date | null;
  precision?: "day" | "time";
  empty?: string;
}) {
  if (!date) return <span className="record-metadata">{empty}</span>;
  return (
    <time dateTime={date.toISOString()} className="record-metadata">
      {(precision === "time" ? timeFormatter : dayFormatter).format(date)}
    </time>
  );
}
