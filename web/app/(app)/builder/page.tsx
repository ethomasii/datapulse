import Link from "next/link";
import { Terminal } from "lucide-react";

export default function BuilderPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ELT Builder</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        The visual and CLI builder today lives in the open-source Python package in this repository. Run it
        locally while we connect hosted workspaces and sync to the dashboard.
      </p>
      <div className="mt-8 rounded-xl border border-slate-200 bg-slate-900 p-4 font-mono text-sm text-slate-100 dark:border-slate-700">
        <div className="mb-2 flex items-center gap-2 text-slate-400">
          <Terminal className="h-4 w-4" aria-hidden />
          <span>Local</span>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap">
          {`cd embedded_elt_builder
pip install -e .
elt ui
# → http://127.0.0.1:8000`}
        </pre>
      </div>
      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        Next steps for the SaaS: persist pipeline definitions per workspace in Neon, proxy or embed the UI,
        and optionally run generation jobs with Anthropic-assisted configs. Track progress on{" "}
        <Link
          href="https://github.com/ethomasii/datapulse"
          className="font-medium text-sky-600 hover:underline dark:text-sky-400"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </Link>
        .
      </p>
    </div>
  );
}
