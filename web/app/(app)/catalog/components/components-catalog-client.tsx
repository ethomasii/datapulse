"use client";

import { useState } from "react";
import Link from "next/link";
import { ComponentPalette, type ComponentListItem } from "@/components/elt/component-palette";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";
import { LakeStarterGallery } from "@/components/elt/lake-starter-gallery";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import { TransformPathsPanel } from "@/components/elt/transform-paths-panel";

export function ComponentCatalogClient() {
  const [selected, setSelected] = useState<ComponentListItem | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
            After ingest
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Transforms</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            Prototype with recipes on the canvas — link a <strong className="font-medium">dbt project</strong> for
            production. Dataframe is legacy when SQL cannot do the job.
          </p>
        </div>
        <TransformJourneyStrip />
      </header>

      <LakeStarterGallery />

      <TransformPathsPanel variant="catalog" />

      <section id="components" className="scroll-mt-6 space-y-4 border-t border-slate-200 pt-8 dark:border-slate-800">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Component palette</h2>
          <p className="mt-1 text-sm text-slate-500">
            Individual transform steps — warehouse SQL by default. Open{" "}
            <Link href="/builder/canvas" className="text-sky-600 underline dark:text-sky-400">
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
                  href="/builder/canvas"
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

      <details className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-slate-900 dark:text-white">
          Advanced — custom component catalogs
        </summary>
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <ComponentCatalogSettings />
        </div>
      </details>
    </div>
  );
}
