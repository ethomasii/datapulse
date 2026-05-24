"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import { ChevronsUpDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectorOption = {
  slug: string;
  label: string;
  category: string;
};

type Props = {
  options: ConnectorOption[];
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Compact mode for tight spaces like canvas nodes */
  compact?: boolean;
  className?: string;
};

export function ConnectorCombobox({
  options,
  value,
  onChange,
  placeholder = "Search connectors…",
  disabled = false,
  compact = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.slug === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  // Filter and group
  const q = search.toLowerCase();
  const filtered = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q) || o.category.toLowerCase().includes(q))
    : options;

  const grouped = new Map<string, ConnectorOption[]>();
  for (const opt of filtered) {
    if (!grouped.has(opt.category)) grouped.set(opt.category, []);
    grouped.get(opt.category)!.push(opt);
  }

  const triggerClass = cn(
    "flex w-full items-center justify-between gap-1.5 rounded border bg-white text-left dark:bg-slate-950",
    compact
      ? "px-1.5 py-0.5 text-[10px]"
      : "px-2.5 py-2 text-sm",
    disabled
      ? "cursor-not-allowed opacity-50"
      : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900",
    className
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        className={triggerClass}
      >
        <span className={cn("truncate", !selected && "text-slate-400 dark:text-slate-500")}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className={cn("shrink-0 text-slate-400", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className={cn(
          "absolute left-0 z-50 mt-1 w-full min-w-[220px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900",
        )}>
          <Command shouldFilter={false}>
            {/* Search input */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-2.5 py-2 dark:border-slate-800">
              <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <Command.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder="Search…"
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
              />
            </div>

            <Command.List className="max-h-64 overflow-y-auto py-1">
              {grouped.size === 0 && (
                <Command.Empty className="px-3 py-6 text-center text-xs text-slate-500">
                  No connectors match &ldquo;{search}&rdquo;
                </Command.Empty>
              )}

              {Array.from(grouped.entries()).map(([category, items]) => (
                <Command.Group key={category} heading={category}>
                  <div className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {category}
                  </div>
                  {items.map((opt) => (
                    <Command.Item
                      key={opt.slug}
                      value={opt.slug}
                      onSelect={() => {
                        onChange(opt.slug);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between px-3 py-1.5 text-sm",
                        "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                        "aria-selected:bg-slate-100 dark:aria-selected:bg-slate-800",
                      )}
                    >
                      <span>{opt.label}</span>
                      {opt.slug === value && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </div>
      )}
    </div>
  );
}
