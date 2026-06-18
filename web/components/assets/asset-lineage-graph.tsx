"use client";

import type { AssetLineageGraph } from "@/lib/elt/asset-lineage";

const KIND_COLOR: Record<string, string> = {
  source: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  raw: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
  transform: "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
  post_transform: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
  object: "border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-100",
};

export function AssetLineageGraph({ graph }: { graph: AssetLineageGraph }) {
  if (graph.nodes.length === 0) return null;

  const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  for (const e of graph.edges) {
    const list = children.get(e.from) ?? [];
    list.push(e.to);
    children.set(e.from, list);
  }

  const roots = graph.nodes.filter((n) => !graph.edges.some((e) => e.to === n.id));

  function NodeCard({ id, depth }: { id: string; depth: number }) {
    const node = byId[id];
    if (!node) return null;
    const kids = children.get(id) ?? [];

    return (
      <div className={depth > 0 ? "ml-4 border-l border-slate-200 pl-4 dark:border-slate-700" : ""}>
        <div
          className={`mb-2 inline-flex max-w-full flex-col rounded-lg border px-3 py-2 ${KIND_COLOR[node.kind] ?? KIND_COLOR.raw}`}
        >
          <span className="text-xs font-semibold">{node.label}</span>
          {node.sublabel ? (
            <span className="mt-0.5 truncate font-mono text-[10px] opacity-80">{node.sublabel}</span>
          ) : null}
        </div>
        {kids.length > 0 ? (
          <div className="space-y-2 pb-2">
            {kids.map((kid) => (
              <NodeCard key={kid} id={kid} depth={depth + 1} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Lineage</p>
      <div className="space-y-1">
        {roots.map((r) => (
          <NodeCard key={r.id} id={r.id} depth={0} />
        ))}
      </div>
    </div>
  );
}
