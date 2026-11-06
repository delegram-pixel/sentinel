import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
};

export function PageHeader({ title, description, metadata, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-5 sm:gap-8">
      <div className="max-w-3xl min-w-0 flex-1 basis-full sm:basis-96">
        <h1 className="page-heading">{title}</h1>
        {description ? (
          <div className="mt-3 max-w-2xl text-sm leading-relaxed text-text-secondary">
            {description}
          </div>
        ) : null}
        {metadata ? <div className="mt-4">{metadata}</div> : null}
      </div>
      {actions ? (
        <div className="flex max-w-full flex-wrap items-center gap-2 sm:pt-1">{actions}</div>
      ) : null}
    </header>
  );
}
