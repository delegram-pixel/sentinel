import Link from "next/link";

export function EvidenceReference({
  id,
  href,
  label = "Evidence",
}: {
  id: string;
  href?: string;
  label?: string;
}) {
  const content = (
    <>
      <span className="text-text-secondary">{label} </span>
      <span className="font-mono">{id.slice(0, 8)}</span>
    </>
  );

  return href ? (
    <Link
      href={href}
      title={id}
      aria-label={`${label} ${id}`}
      className="text-xs text-primary underline decoration-border underline-offset-4 hover:decoration-primary"
    >
      {content}
    </Link>
  ) : (
    <span title={id} className="text-xs" aria-label={`${label} ${id}`}>
      {content}
    </span>
  );
}
