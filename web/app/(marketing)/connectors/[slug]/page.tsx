import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ExternalLink, Zap } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { RoleBadge } from "@/components/marketing/connector-catalog-browser";
import { ScenarioCard } from "@/components/marketing/scenario-cards";
import { quickStartUrl } from "@/lib/elt/quick-start-catalog";
import { TRUST_LABELS, TRUST_STYLES } from "@/lib/elt/connector-trust";
import {
  getAllMarketingConnectors,
  getMarketingConnector,
  resolveConnectorSlug,
  suggestedPairings,
} from "@/lib/marketing/connector-catalog";
import { jsonLdScript, marketingPageMetadata } from "@/lib/marketing/seo";
import { scenariosForConnector } from "@/lib/marketing/pipeline-scenarios";

type Props = { params: Promise<{ slug: string }> };

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev";

export async function generateStaticParams() {
  return getAllMarketingConnectors().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const connector = getMarketingConnector(slug);
  if (!connector) return { title: "Connector" };
  const path = `/connectors/${connector.slug}`;
  return marketingPageMetadata({
    title: `${connector.name} ${connector.role === "source" ? "source" : "destination"} connector`,
    description: connector.description,
    path,
    keywords: [
      connector.name,
      connector.slug,
      connector.role,
      connector.tool ?? "elt",
      "dlt",
      "Sling",
      "ELT",
      "data pipeline",
    ],
  });
}

export default async function ConnectorDetailPage({ params }: Props) {
  const { slug: raw } = await params;
  const slug = resolveConnectorSlug(raw);
  const connector = getMarketingConnector(slug);
  if (!connector) notFound();

  const scenarios = scenariosForConnector(connector.slug);
  const pairings = suggestedPairings(connector);
  const pageUrl = `${appUrl}/connectors/${connector.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `${connector.name} connector — eltPulse`,
    applicationCategory: "DataApplication",
    description: connector.description,
    url: pageUrl,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    provider: {
      "@type": "Organization",
      name: "eltPulse",
      url: appUrl,
    },
  };

  const primaryScenario = scenarios[0];
  const startHref = primaryScenario
    ? quickStartUrl({
        source: primaryScenario.sourceSlug,
        destination: primaryScenario.destinationSlug,
        scenario: primaryScenario.id,
      })
    : connector.role === "source" && pairings[0]
      ? quickStartUrl({ source: connector.slug, destination: pairings[0].slug })
      : connector.role === "destination" && pairings[0]
        ? quickStartUrl({ source: pairings[0].slug, destination: connector.slug })
        : "/quick-start";

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(jsonLd)} />

      <nav className="text-sm text-slate-500 dark:text-slate-400">
        <Link href="/connectors" className="hover:text-sky-600 dark:hover:text-sky-400">
          Connectors
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 dark:text-slate-300">{connector.name}</span>
      </nav>

      <div className="mt-6 flex items-start gap-4">
        <ConnectorIcon slug={connector.slug} name={connector.name} size={48} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge role={connector.role} />
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${TRUST_STYLES[connector.trustTier]}`}
            >
              {TRUST_LABELS[connector.trustTier]}
            </span>
            {connector.tool ? (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200">
                {connector.tool}
              </span>
            ) : null}
            <span className="text-xs text-slate-500 dark:text-slate-400">{connector.category}</span>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {connector.name}
          </h1>
        </div>
      </div>

      <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{connector.description}</p>

      <div className="mt-8">
        <Link
          href={startHref}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <Zap className="h-4 w-4" />
          {primaryScenario ? "Start recommended scenario" : "Quick start with this connector"}
        </Link>
      </div>

      {connector.auth.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Authentication
          </h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {connector.auth.map((a) => (
              <li key={a}>· {a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {connector.params.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Key configuration
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {connector.params.join(", ")}
            {connector.incremental ? " · supports incremental loads" : ""}
          </p>
        </section>
      ) : null}

      {scenarios.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Use cases</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            How teams pair {connector.name} in production pipelines.
          </p>
          <div className="mt-6 space-y-6">
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} />
            ))}
          </div>
        </section>
      ) : null}

      {pairings.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Popular {connector.role === "source" ? "destinations" : "sources"}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {pairings.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/connectors/${p.slug}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-800 hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-800 dark:hover:bg-sky-950/30"
                >
                  <ConnectorIcon slug={p.slug} name={p.name} size={18} />
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-12 flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Build a pipeline
          <ArrowRight className="h-4 w-4" />
        </Link>
        {connector.docsUrl ? (
          <a
            href={connector.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            dlt verified source docs
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
        <Link
          href="/scenarios"
          className="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          All scenarios
        </Link>
      </section>
    </div>
  );
}
