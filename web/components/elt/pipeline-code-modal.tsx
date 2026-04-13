"use client";

import { useState } from "react";
import { Check, Copy, Download, Info, Terminal } from "lucide-react";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";

type Props = {
  tool: string;           // internal only — never shown
  pipelineCode: string;
  configYaml: string | null;
  workspaceYaml: string | null;
  pipelineName?: string;
  onClose: () => void;
};

type Tab = "sync" | "config" | "workspace";

const TAB_META: Record<Tab, { label: string; file: string; description: string }> = {
  sync: {
    label: "Sync runner",
    file: ELTPULSE_REPO.syncRunnerFile,
    description:
      "Executable sync definition for this pipeline. Run on your own infra or let eltPulse manage it — same code either way.",
  },
  config: {
    label: "Connection config",
    file: ELTPULSE_REPO.pipelineConfigFile,
    description:
      "Source and destination parameters. Keep secrets in environment variables; this file is safe to commit.",
  },
  workspace: {
    label: "Workspace manifest",
    file: ELTPULSE_REPO.workspaceFile,
    description:
      "eltPulse orchestration metadata: scheduling, quality checks, monitors, and run slice settings.",
  },
};

export function PipelineCodeModal({
  tool: _tool,
  pipelineCode,
  configYaml,
  workspaceYaml,
  pipelineName,
  onClose,
}: Props) {
  const [tab, setTab] = useState<Tab>("sync");
  const [copied, setCopied] = useState(false);

  const content =
    tab === "sync" ? pipelineCode
    : tab === "config" ? (configYaml ?? "")
    : (workspaceYaml ?? "");

  const { file, description } = TAB_META[tab];

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function download() {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-labelledby="dp-export-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-sky-600" />
            <h3 id="dp-export-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Deployment package{pipelineName ? ` — ${pipelineName}` : ""}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Download className="h-4 w-4" />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex gap-0.5 border-b border-slate-200 px-2 dark:border-slate-800">
          {(Object.keys(TAB_META) as Tab[]).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition ${
                tab === id
                  ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {TAB_META[id].label}
            </button>
          ))}
        </div>

        <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900/60">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-300">{description}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {"Path: "}
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">
                {ELTPULSE_REPO.pipelinesDir}/&lt;name&gt;/{file}
              </code>
            </p>
          </div>
        </div>

        <div className="border-b border-sky-100 bg-sky-50/60 px-5 py-2 dark:border-sky-900/40 dark:bg-sky-900/10">
          <p className="text-xs text-sky-800 dark:text-sky-300">
            <strong className="font-semibold">Run anywhere.</strong>{" "}
            Deploy to your own infrastructure and point the runner at the eltPulse API for logs and
            observability — or let eltPulse run it for you. Either way, you own the code.
          </p>
        </div>

        <pre className="min-h-[200px] flex-1 overflow-auto bg-slate-950 p-5 text-xs leading-relaxed text-slate-100">
          {content || "—"}
        </pre>
      </div>
    </div>
  );
}
