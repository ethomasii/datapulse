export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  /** When true, step is optional and not counted toward "all done" progress. */
  optional?: boolean;
};

/**
 * Ordered for time-to-first-sync (Fivetran-style): credentials → pipeline → run.
 * Gateway/self-hosted setup is advanced and optional — managed execution is the default.
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "connection",
    label: "Connect your warehouse",
    description: "Save destination credentials once — reuse across pipelines",
    href: "/connections",
  },
  {
    id: "pipeline",
    label: "Create a pipeline",
    description: "Pick a source from the catalog or ask the AI assistant",
    href: "/builder",
  },
  {
    id: "run",
    label: "Run your first sync",
    description: "Hit Run in the builder — demo mode works instantly; enable real execution on Gateway",
    href: "/builder",
  },
  {
    id: "execution",
    label: "Enable real execution",
    description: "eltPulse-managed compute runs pipelines for you; use a gateway only for private network access",
    href: "/gateway",
    optional: true,
  },
  {
    id: "webhook",
    label: "Set up alerts",
    description: "Get notified when runs finish — Slack, CI, or PagerDuty",
    href: "/webhooks",
    optional: true,
  },
  {
    id: "gateway",
    label: "Self-hosted gateway",
    description: "Optional: run pipelines in your VPC with a customer gateway",
    href: "/gateway",
    optional: true,
  },
];

export type OnboardingState = {
  completedIds: string[];
  dismissed: boolean;
};

/** Steps that count toward the main progress bar (excludes optional advanced setup). */
export const CORE_ONBOARDING_STEPS = ONBOARDING_STEPS.filter((s) => !s.optional);
