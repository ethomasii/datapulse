"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  BookOpen,
  Cable,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  FolderGit2,
  GitBranch,
  LayoutGrid,
  LayoutDashboard,
  Layers,
  PlayCircle,
  Plug,
  Route,
  Split,
  Table2,
  TableProperties,
  UserCircle,
  Users,
  Waypoints,
  Webhook,
  Workflow,
  Zap,
  Sparkles,
} from "lucide-react";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_COLLAPSED_KEY = "eltpulse-nav-collapsed";
const NAV_ADVANCED_KEY = "eltpulse-nav-advanced";
const NAV_CATALOG_KEY = "eltpulse-nav-catalog";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

const CORE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quick-start", label: "Quick start", icon: Zap },
  { href: "/builder", label: "Pipelines", icon: Layers },
  { href: "/connections", label: "Connections", icon: Cable },
  { href: "/runs", label: "Runs", icon: PlayCircle },
  { href: "/observability", label: "Observability", icon: Activity },
];

const CATALOG_NAV: NavItem[] = [
  { href: "/catalog", label: "Overview", icon: LayoutGrid },
  { href: "/assets", label: "Assets", icon: Table2 },
  { href: "/catalog/components", label: "Components", icon: Sparkles },
  { href: "/catalog/transform-hub", label: "Transform hub", icon: Workflow },
  { href: "/catalog/dbt", label: "My dbt projects", icon: GitBranch },
  { href: "/catalog/connectors", label: "Connectors", icon: Plug },
  { href: "/catalog/scenarios", label: "Scenarios", icon: Route },
];

const ADVANCED_NAV: NavItem[] = [
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/sources", label: "Source Registry", icon: BookOpen },
  { href: "/orchestration", label: "Monitors", icon: Split },
  { href: "/schedule", label: "Schedules", icon: CalendarClock },
  { href: "/run-slices", label: "Run slices", icon: TableProperties },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/gateway", label: "Gateway", icon: Waypoints },
  { href: "/repos", label: "Repositories", icon: FolderGit2 },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/help", label: "Help", icon: CircleHelp },
  { href: "/team", label: "Team", icon: Users, soon: true },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/account", label: "Account & Settings", icon: UserCircle },
];

function navLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  return pathname.startsWith(`${href}/`);
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
}) {
  const { href, label, icon: Icon, soon } = item;
  const active = navLinkActive(pathname, href);
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={clsx(
        "flex w-full items-center rounded-lg text-sm font-medium transition",
        collapsed ? "justify-center px-2 py-2" : "gap-2 px-3 py-2",
        active
          ? "bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {soon ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Soon
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}

function NavSection({
  label,
  items,
  pathname,
  collapsed,
}: {
  label: string;
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
      )}
      {collapsed && <div className="mb-1 h-px bg-slate-100 dark:bg-slate-800" aria-hidden />}
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} pathname={pathname} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const catalogActive = CATALOG_NAV.some((item) => navLinkActive(pathname, item.href));
  const advancedActive = ADVANCED_NAV.some((item) => navLinkActive(pathname, item.href));

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
      const stored = localStorage.getItem(NAV_ADVANCED_KEY);
      if (stored === "1") setAdvancedOpen(true);
      const catalogStored = localStorage.getItem(NAV_CATALOG_KEY);
      if (catalogStored === "1") setCatalogOpen(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (advancedActive) setAdvancedOpen(true);
  }, [advancedActive]);

  useEffect(() => {
    if (catalogActive) setCatalogOpen(true);
  }, [catalogActive]);

  function toggleCatalog() {
    setCatalogOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(NAV_CATALOG_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleAdvanced() {
    setAdvancedOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(NAV_ADVANCED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleCollapsed() {
    setCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem(NAV_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const mobileAll: NavItem[] = [
    ...CORE_NAV,
    { href: "/assets", label: "Assets", icon: Table2 },
    { href: "/catalog", label: "Catalog", icon: LayoutGrid },
    ...ADVANCED_NAV.slice(0, 2),
    ...ACCOUNT_NAV,
  ];

  const asideWidth = collapsed ? "md:w-14" : "md:w-56";
  const mainPad = collapsed ? "md:pl-14" : "md:pl-56";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-900 md:flex",
          asideWidth
        )}
      >
        <div
          className={clsx(
            "flex h-14 shrink-0 items-center border-b border-slate-200 dark:border-slate-800",
            collapsed ? "justify-center px-2" : "gap-2 px-4"
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2" title="eltPulse">
            <Activity className="h-6 w-6 shrink-0 text-sky-600" aria-hidden />
            {!collapsed && (
              <span className="font-semibold text-slate-900 dark:text-slate-100">eltPulse</span>
            )}
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-6 overflow-y-auto p-3" aria-label="App">
          <NavSection label="Product" items={CORE_NAV} pathname={pathname} collapsed={collapsed} />
          {!collapsed ? (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={toggleCatalog}
                className={clsx(
                  "mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest transition",
                  catalogActive
                    ? "text-sky-700 dark:text-sky-300"
                    : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                )}
              >
                Catalog
                {catalogOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
              {catalogOpen ? (
                <ul className="space-y-0.5">
                  {CATALOG_NAV.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} pathname={pathname} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <NavSection label="Catalog" items={CATALOG_NAV} pathname={pathname} collapsed={collapsed} />
          )}
          {!collapsed ? (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={toggleAdvanced}
                className="mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                Advanced
                {advancedOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                )}
              </button>
              {advancedOpen ? (
                <ul className="space-y-0.5">
                  {ADVANCED_NAV.map((item) => (
                    <li key={item.href}>
                      <NavLink item={item} pathname={pathname} collapsed={collapsed} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <NavSection label="More" items={ADVANCED_NAV} pathname={pathname} collapsed={collapsed} />
          )}
          <NavSection label="Account & Settings" items={ACCOUNT_NAV} pathname={pathname} collapsed={collapsed} />
        </nav>
        <div
          className={clsx(
            "border-t border-slate-200 p-2 dark:border-slate-800",
            collapsed ? "flex justify-center" : "flex justify-end"
          )}
        >
          <button
            type="button"
            onClick={toggleCollapsed}
            disabled={!mounted}
            title={collapsed ? "Expand navigation" : "Collapse navigation"}
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>
      <div className={clsx("transition-[padding] duration-200", mainPad)}>
        <header className="sticky top-0 z-30 flex min-h-14 w-full flex-col gap-2 border-b border-slate-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8 md:flex-row md:items-center md:py-0">
          <nav className="flex flex-1 flex-wrap gap-1 md:hidden" aria-label="Mobile">
            {mobileAll.map((item) => {
              const active = navLinkActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium",
                    active
                      ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                >
                  <item.icon className="h-3 w-3 shrink-0" aria-hidden />
                  <span className="max-w-[4.5rem] truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-1 items-center justify-end gap-2 md:ml-auto">
            <ThemeToggle />
            <UserButton afterSignOutUrl="/" />
          </div>
        </header>
        <main className="min-h-0 min-w-0 w-full flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <AiPipelineAssistant />
    </div>
  );
}
