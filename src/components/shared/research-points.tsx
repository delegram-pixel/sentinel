export function ResearchPoints({
  title,
  values,
  emptyLabel,
}: {
  title: string;
  values: string[];
  emptyLabel?: string;
}) {
  if (values.length === 0 && !emptyLabel) return null;

  return (
    <div className="min-w-0">
      <p className="mb-2 text-xs font-medium">{title}</p>
      {values.length ? (
        <ul className="flex list-disc flex-col gap-2 pl-4 text-sm leading-relaxed text-text-secondary">
          {values.map((value, index) => (
            <li key={index} className="break-words">
              {value}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">{emptyLabel}</p>
      )}
    </div>
  );
}
