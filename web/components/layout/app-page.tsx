import clsx from "clsx";
import type { ReactNode } from "react";

export type AppPageWidth = "narrow" | "default" | "wide";

const WIDTH_CLASS: Record<AppPageWidth, string> = {
  /** Settings, help, integrations, repos, webhooks, gateway */
  narrow: "max-w-4xl",
  /** Most list and catalog pages */
  default: "max-w-6xl",
  /** Dashboard, pipelines, runs, observability */
  wide: "max-w-7xl",
};

type AppPageProps = {
  children: ReactNode;
  width?: AppPageWidth;
  className?: string;
};

/** Centered app content shell — use on every authenticated page for consistent width and spacing. */
export function AppPage({ children, width = "default", className }: AppPageProps) {
  return (
    <div className={clsx("mx-auto w-full min-w-0 space-y-8", WIDTH_CLASS[width], className)}>
      {children}
    </div>
  );
}

type AppPageHeaderProps = {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  className?: string;
};

export function AppPageHeader({ title, description, eyebrow, actions, className }: AppPageHeaderProps) {
  return (
    <header
      className={clsx("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={clsx("text-2xl font-bold text-slate-900 dark:text-white", eyebrow && "mt-1")}>
          {title}
        </h1>
        {description ? (
          <div className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
