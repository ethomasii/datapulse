"use client";

type SlugUrlInputProps = {
  prefix: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  hint?: string;
};

/** Slug field with a visible URL prefix (ServicePulse-style). */
export function SlugUrlInput({
  prefix,
  value,
  onChange,
  disabled,
  placeholder = "acme",
  hint,
}: SlugUrlInputProps) {
  return (
    <div>
      <div
        className={`flex overflow-hidden rounded-lg border border-slate-300 dark:border-slate-600 focus-within:border-sky-500 focus-within:ring-1 focus-within:ring-sky-500 ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <span className="flex items-center border-r border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {prefix}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
          disabled={disabled}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 focus:outline-none disabled:cursor-not-allowed dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
    </div>
  );
}
