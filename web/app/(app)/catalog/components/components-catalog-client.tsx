"use client";

import { useState } from "react";
import Link from "next/link";
import { ComponentPalette, type ComponentListItem } from "@/components/elt/component-palette";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";
import { LakeStarterGallery } from "@/components/elt/lake-starter-gallery";
import { TransformPathsPanel } from "@/components/elt/transform-paths-panel";

export function ComponentCatalogClient() {
  const [selected, setSelected] = useState<ComponentListItem | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transforms</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Everything after ingest on one lake — visual recipes, native components, BYO compile packages, or a linked
          dbt project.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Pick a <strong className="font-medium text-slate-700 dark:text-slate-300">recipe</strong> below, fine-tune on
          the{" "}
          <Link href="/builder/canvas" className="text-sky-600 underline dark:text-sky-400">
            visual canvas
          </Link>
          , then save the pipeline to compile warehouse SQL.
        </p>
      </div>

      <TransformPathsPanel />

      <LakeStarterGallery
        canvasHref={(starterId) =>
          `/builder/canvas?starter=${encodeURIComponent(starterId)}&source_table=${encodeURIComponent("staging.events")}`
        }
      />

      <ComponentCatalogSettings />

      <div id="components" className="scroll-mt-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Component palette</h2>
        <p className="mt-1 text-sm text-slate-500">
          Executable natives — warehouse SQL by default. Drag onto canvas or click to add.
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
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{selected.name}</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{selected.description}</p>
              <p className="mt-2 text-xs text-slate-500">{selected.compileHint}</p>
              {selected.compileTarget === "warehouse" ? (
                <p className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
                  Warehouse SQL — compiles to CREATE TABLE AS after load. Not a dbt model; set execution=dataframe for
                  worker pandas.
                </p>
              ) : null}
              {selected.monitorPair ? (
                <p className="mt-3 text-xs text-violet-700 dark:text-violet-300">
                  ↔ {selected.monitorPair.label}
                </p>
              ) : null}
              <p className="mt-4 font-mono text-xs text-slate-400">id: {selected.id}</p>
              <Link
                href="/builder/canvas"
                className="mt-4 inline-block rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                Add on canvas
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-500">Select a transform to see compile route and hints.</p>
          )}
        </div>
      </div>
    </div>
  );
}
