export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "pipeline",
    label: "Create a pipeline",
    description: "Define your first source → destination connection in the builder",
    href: "/builder",
  },
  {
    id: "connection",
    label: "Connect a data source",
    description: "Link credentials for your warehouse or source system",
    href: "/connections",
  },
  {
    id: "gateway",
    label: "Configure execution",
    description: "Use eltPulse-managed workers or connect your own gateway",
    href: "/gateway",
  },
  {
    id: "run",
    label: "Run your first sync",
    description: "Trigger a pipeline run and watch live telemetry stream in",
    href: "/runs",
  },
  {
    id: "webhook",
    label: "Set up a webhook",
    description: "Get notified when runs finish — wire into Slack, CI, or PagerDuty",
    href: "/webhooks",
  },
];

export type OnboardingState = {
  completedIds: string[];
  dismissed: boolean;
};
