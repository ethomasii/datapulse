"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, X } from "lucide-react";
import { ComponentPalette, type ComponentListItem } from "@/components/elt/component-palette";

type CodeTransformTool = "dbt" | "sql" | "python";

type Props = {
  onAddNative: (component: ComponentListItem) => void;
  onAddCode: (tool: CodeTransformTool) => void;
};

const CODE_OPTIONS: { tool: CodeTransformTool; label: string; hint: string }[] = [
  { tool: "dbt", label: "dbt project", hint: "Versioned SQL models in git" },
  { tool: "sql", label: "Warehouse SQL", hint: "CTAS / views after load" },
  { tool: "python", label: "Legacy Python", hint: "Worker dataframe when SQL cannot" },
];

/** Toolbar control: native component transforms vs code-based transform nodes. */
export function AddTransformMenu({ onAddNative, onAddCode }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [nativeOpen, setNativeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [menuOpen]);

  const pickNative = useCallback(
    (component: ComponentListItem) => {
      onAddNative(component);
      setNativeOpen(false);
      setMenuOpen(false);
    },
    [onAddNative]
  );

  const pickCode = useCallback(
    (tool: CodeTransformTool) => {
      onAddCode(tool);
      setMenuOpen(false);
    },
    [onAddCode]
  );

  return (
    <>
      <div className="relative inline-flex" ref={menuRef}>
        <button
          type="button"
          onClick={() => {
            setNativeOpen(true);
            setMenuOpen(false);
          }}
          className="inline-flex items-center gap-1 rounded-l-lg border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-950 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-900/40"
          title="Add a native transform (cleanse, join, aggregate, …)"
        >
          <Plus className="h-3.5 w-3.5" />
          Native
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 rounded-r-lg border border-l-0 border-amber-300 bg-amber-50 px-1.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/40"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Add a code transform (dbt, SQL, Python)"
        >
          Code
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              Code transform
            </p>
            {CODE_OPTIONS.map((opt) => (
              <button
                key={opt.tool}
                type="button"
                role="menuitem"
                onClick={() => pickCode(opt.tool)}
                className="block w-full px-3 py-2 text-left hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <span className="text-xs font-medium text-slate-900 dark:text-white">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">{opt.hint}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {nativeOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="native-transform-picker-title"
          onClick={() => setNativeOpen(false)}
        >
          <div
            className="flex max-h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
              <div>
                <h2 id="native-transform-picker-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                  Add native transform
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Cleanse, dedupe, join, aggregate, and 70+ compiled steps — same as lake starters use.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNativeOpen(false)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ComponentPalette
              className="min-h-0 flex-1 border-0"
              transformDesigner
              nativeOnly
              onSelect={pickNative}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
