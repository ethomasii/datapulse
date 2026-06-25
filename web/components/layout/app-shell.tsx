"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Activity,
  BookOpen,
  Cable,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  FolderGit2,
  LayoutDashboard,
  Layers,
  Network,
  PenLine,
  PlayCircle,
  Split,
  Table2,
  UserCircle,
  Waypoints,
  Webhook,
  Zap,
} from "lucide-react";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_COLLAPSED_KEY = "eltpulse-nav-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

/** Sidebar IA — compact; Library hub covers recipes, dbt, connectors, products, contracts. */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Home", icon: LayoutDashboard }],
  },
  {
    label: "Build",
    items: [
      { href: "/builder", label: "Pipelines", icon: Layers },
      { href: "/builder/canvas", label: "Visual canvas", icon: PenLine },
      { href: "/workflows", label: "Pipeline chains", icon: Network },
      { href: "/connections", label: "Connections", icon: Cable },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/runs", label: "Runs", icon: PlayCircle },
      { href: "/schedule", label: "Schedules", icon: CalendarClock },
      { href: "/orchestration", label: "Monitors", icon: Split },
      { href: "/observability", label: "Metrics", icon: Activity },
    ],
  },
  {
    label: "Data catalog",
    items: [{ href: "/assets", label: "Assets", icon: Table2 }],
  },
  {
    label: "Discover",
    items: [
      { href: "/quick-start", label: "Quick start", icon: Zap },
      { href: "/catalog", label: "Library", icon: BookOpen },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/gateway", label: "Gateway", icon: Waypoints },
      { href: "/webhooks", label: "Webhooks", icon: Webhook },
      { href: "/repos", label: "Repositories", icon: FolderGit2 },
      { href: "/help", label: "Help", icon: CircleHelp },
    ],
  },
];

const ACCOUNT_NAV: NavItem[] = [
  { href: "/account", label: "Account & Settings", icon: UserCircle },
];

const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_SECTIONS.flatMap((section) => section.items),
  ...ACCOUNT_NAV,
];

function navLinkActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/dashboard") return false;
  if (href === "/builder") {
    return pathname === "/builder";
  }
  if (href === "/builder/canvas") {
    return pathname.startsWith("/builder/canvas");
  }
  if (href === "/catalog") {
    return (
      pathname === "/catalog" ||
      pathname.startsWith("/catalog/") ||
      pathname === "/sources" ||
      pathname.startsWith("/sources/")
    );
  }
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
        "flex w-full items-center rounded-lg text-[13px] font-medium transition",
        collapsed ? "justify-center px-2 py-1.5" : "gap-2 px-2.5 py-1.5",
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

function NavSectionBlock({
  section,
  pathname,
  collapsed,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <p className="mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {section.label}
        </p>
      )}
      {collapsed && <div className="mb-1 h-px bg-slate-100 dark:bg-slate-800" aria-hidden />}
      <ul className="space-y-0.5">
        {section.items.map((item) => (
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
  const hideFloatingAi = pathname?.startsWith("/builder/canvas");
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      setCollapsed(localStorage.getItem(NAV_COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

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
    NAV_SECTIONS[0]!.items[0]!,
    NAV_SECTIONS[1]!.items[0]!,
    NAV_SECTIONS[1]!.items[1]!,
    NAV_SECTIONS[2]!.items[0]!,
    NAV_SECTIONS[3]!.items[0]!,
    NAV_SECTIONS[4]!.items[1]!,
    ACCOUNT_NAV[0]!,
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
        <nav
          className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="App"
        >
          {NAV_SECTIONS.map((section) => (
            <NavSectionBlock
              key={section.label}
              section={section}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}
          <NavSectionBlock
            section={{ label: "Account", items: ACCOUNT_NAV }}
            pathname={pathname}
            collapsed={collapsed}
          />
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
      {!hideFloatingAi ? <AiPipelineAssistant /> : null}
    </div>
  );
}

// Exported for tests or breadcrumbs that need the canonical nav list.
export { ALL_NAV_ITEMS, NAV_SECTIONS, navLinkActive };
