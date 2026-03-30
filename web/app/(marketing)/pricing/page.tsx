import Link from "next/link";
import { Check } from "lucide-react";

const tiers = [
  {
    name: "Free",
    price: "$0",
    description: "Explore the product and run the open-source builder locally.",
    features: ["Sign in with Clerk", "Dashboard & docs", "Community support"],
    cta: { href: "/sign-up", label: "Get started" },
    highlighted: false,
  },
  {
    name: "Pro",
    price: "From $29",
    description: "Hosted workspace, sync, and automation (coming soon).",
    features: [
      "Everything in Free",
      "Stripe billing (when enabled)",
      "Email via Resend",
      "Higher limits",
    ],
    cta: { href: "/sign-up", label: "Join waitlist" },
    highlighted: true,
  },
  {
    name: "Team",
    price: "Let’s talk",
    description: "SSO, shared workspaces, and priority support.",
    features: ["Everything in Pro", "Org-wide policies", "Dedicated onboarding"],
    cta: { href: "mailto:hello@datapulse.dev", label: "Contact" },
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Pricing</h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Start free. Upgrade when hosted workspaces and team features land.
        </p>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`flex flex-col rounded-2xl border p-8 ${
              tier.highlighted
                ? "border-sky-500 bg-sky-50/50 dark:border-sky-600 dark:bg-sky-950/30"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{tier.name}</h2>
            <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">{tier.price}</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tier.description}</p>
            <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-slate-600 dark:text-slate-300">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.cta.href}
              className={`mt-8 block rounded-lg py-2.5 text-center text-sm font-semibold ${
                tier.highlighted
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>
      <p className="mt-12 text-center text-sm text-slate-500 dark:text-slate-400">
        Stripe Checkout and plan enforcement wire up to the same webhooks pattern as ServicePulse — see{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/api/webhooks/stripe</code>.
      </p>
    </div>
  );
}
