"use client";

import { useState } from "react";
import Link from "next/link";
import { ComponentPalette, type ComponentListItem } from "@/components/elt/component-palette";
import { ComponentCatalogSettings } from "@/components/elt/component-catalog-settings";

export function ComponentCatalogClient() {
  const [selected, setSelected] = useState<ComponentListItem | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Transform catalog</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Warehouse-native transforms for governed customer analytics — filter, join, aggregate, and segment
          on data that already lives in your lakehouse. SQL push-down by default; dataframe path when you need
          in-memory logic on the worker.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Build Customer 360, audience segments, and activation-ready marts without copying data out of the
          warehouse. Use the{" "}
          <Link href="/builder/canvas" className="text-sky-600 underline dark:text-sky-400">
            visual canvas
          </Link>{" "}
          AI builder or add your own compile packages below.
        </p>
      </div>

      <ComponentCatalogSettings />

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
              {selected.monitorPair ? (
                <p className="mt-3 text-xs text-violet-700 dark:text-violet-300">
                  ↔ {selected.monitorPair.label}
                </p>
              ) : null}
              <p className="mt-4 font-mono text-xs text-slate-400">id: {selected.id}</p>
              <Link
                href={`/builder/canvas`}
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
