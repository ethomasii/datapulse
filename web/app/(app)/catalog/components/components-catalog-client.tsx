"use client";

import { useState } from "react";
import Link from "next/link";
import { ComponentPalette, type ComponentListItem } from "@/components/elt/component-palette";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";
import { LakeStarterGallery } from "@/components/elt/lake-starter-gallery";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import { TransformPathsPanel } from "@/components/elt/transform-paths-panel";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";

export function ComponentCatalogClient() {
  const [selected, setSelected] = useState<ComponentListItem | null>(null);

  return (
    <AppPage width="default" className="space-y-10">
      <AppPageHeader
        eyebrow="After ingest"
        title="Transforms"
        description={
          <>
            Prototype with recipes on the canvas — link a <strong className="font-medium">dbt project</strong> for
            production. Dataframe is legacy when SQL cannot do the job.
          </>
        }
      />
      <TransformJourneyStrip />
      <p className="text-sm">
        <Link href="/catalog/dbt/new" className="font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
          Promote canvas recipes to a dbt project →
        </Link>
      </p>

      <LakeStarterGallery />

      <TransformPathsPanel variant="catalog" />

      <section id="components" className="scroll-mt-6 space-y-4 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Component palette</h2>
          <p className="mt-1 text-sm text-slate-500">
            Individual transform steps — warehouse SQL by default. Open{" "}
            <Link href="/builder?view=canvas" className="text-sky-600 underline dark:text-sky-400">
              canvas
            </Link>{" "}
            to compose a graph.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <ComponentPalette
            className="h-[min(70vh,640px)]"
            transformDesigner
            onSelect={(c) => setSelected(c)}
          />
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            {selected ? (
              <>
                <p className="text-[10px] font-semibold uppercase text-violet-600">
                  {selected.compileTargetLabel ?? selected.compileTarget}
                </p>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.name}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{selected.description}</p>
                <p className="mt-2 text-xs text-slate-500">{selected.compileHint}</p>
                {selected.compileTarget === "warehouse" ? (
                  <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
                    Warehouse SQL on your destination — not a dbt model unless you link git separately.
                  </p>
                ) : null}
                <Link
                  href="/builder?view=canvas"
                  className="mt-4 inline-block rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
                >
                  Add on canvas
                </Link>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a component to preview compile route and hints.</p>
            )}
          </div>
        </div>
      </section>

      <details
        id="custom-catalogs"
        className="scroll-mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/40 dark:border-slate-700 dark:bg-slate-900/30"
      >
        <summary className="cursor-pointer px-4 py-3 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300">
          Custom component catalogs (advanced)
        </summary>
        <div className="border-t border-dashed border-slate-200 px-4 py-4 dark:border-slate-700">
          <ComponentCatalogSettings embedded />
        </div>
      </details>
    </AppPage>
  );
}
