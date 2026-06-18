"use client";

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart2,
  Box,
  CheckCircle,
  Cloud,
  Database,
  FileInput,
  Filter,
  GitBranch,
  Layers,
  Merge,
  Radar,
  Server,
  Sparkles,
  Table2,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ingestion: FileInput,
  source: Database,
  sink: Cloud,
  transformation: Filter,
  analytics: BarChart2,
  check: CheckCircle,
  sensor: Radar,
  observation: Activity,
  dbt: GitBranch,
  ai: Sparkles,
  infrastructure: Server,
  integration: Workflow,
  external: Layers,
};

const ID_ICONS: Record<string, LucideIcon> = {
  filter_rows: Filter,
  join_tables: Merge,
  union_tables: Layers,
  select_columns: Table2,
  drop_duplicates: Box,
  dq_check: CheckCircle,
  freshness_check: Activity,
  s3_monitor: Radar,
  s3_to_database_asset: FileInput,
  kafka_to_database_asset: Zap,
  rest_api_fetcher: Cloud,
};

const LUCIDE_BY_NAME: Record<string, LucideIcon> = {
  BarChart2,
  Radar,
  Server,
  CheckCircle,
  Database,
  Filter,
  Layers,
  Activity,
  Sparkles,
  Workflow,
  Zap,
  Cloud,
  Table2,
  GitBranch,
  FileInput,
};

type Props = {
  componentId?: string;
  category?: string;
  manifestIcon?: string;
  compileTarget?: string;
  className?: string;
  size?: "sm" | "md";
};

export function ComponentIcon({
  componentId,
  category,
  manifestIcon,
  compileTarget,
  className,
  size = "md",
}: Props) {
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  let Icon: LucideIcon | null = null;
  if (componentId && ID_ICONS[componentId]) Icon = ID_ICONS[componentId];
  if (!Icon && manifestIcon) {
    if (manifestIcon.startsWith("si:")) {
      Icon = Box;
    } else if (LUCIDE_BY_NAME[manifestIcon]) {
      Icon = LUCIDE_BY_NAME[manifestIcon];
    }
  }
  if (!Icon && category) {
    const cat = category.trim().toLowerCase();
    Icon = CATEGORY_ICONS[cat] ?? null;
  }
  if (!Icon && compileTarget) {
    Icon =
      compileTarget === "quality"
        ? CheckCircle
        : compileTarget === "monitor"
          ? Radar
          : compileTarget === "dlt" || compileTarget === "sling"
            ? FileInput
            : compileTarget === "dbt"
              ? GitBranch
              : compileTarget === "python"
                ? Filter
                : Box;
  }
  if (!Icon) Icon = Box;

  return <Icon className={cn(dim, "shrink-0", className)} aria-hidden />;
}
