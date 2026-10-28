import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Settings,
  WifiOff,
} from "lucide-react";
import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getAiStatus } from "../../lib/api";
import { cn } from "../../lib/cn";
import type { AIStatus } from "../../types/api";
import { Logo } from "../ui/Logo";

const navigation = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study", label: "Study workspace", icon: BookOpen },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

function statusPresentation(status?: AIStatus): { label: string; dot: string; text: string } {
  if (!status) return { label: "Checking AI", dot: "bg-ink-300", text: "text-ink-500" };
  switch (status.status) {
    case "ready":
      return { label: "AI ready", dot: "bg-emerald-500", text: "text-emerald-700" };
    case "unconfigured":
      return { label: "AI not configured", dot: "bg-ink-400", text: "text-ink-500" };
    case "auth_error":
      return { label: "AI key rejected", dot: "bg-rose-500", text: "text-rose-700" };
    case "unreachable":
      return { label: "AI unreachable", dot: "bg-rose-500", text: "text-rose-700" };
    case "model_missing":
      return { label: "Model not listed", dot: "bg-amber-500", text: "text-amber-700" };
    default:
      return { label: "AI needs attention", dot: "bg-amber-500", text: "text-amber-700" };
  }
}

function SidebarStatus() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["ai-status"],
    queryFn: () => getAiStatus(),
    staleTime: 60_000,
    retry: false,
  });
  const presentation = statusPresentation(data);
  const subtitle = isError
    ? "Start the FastAPI server"
    : isLoading
      ? "Checking provider status"
      : data?.status === "unconfigured"
        ? "Configure a provider in Settings"
        : data?.model || data?.detail || "Provider status unavailable";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isLoading || isError ? "bg-ink-400" : presentation.dot,
          )}
          aria-hidden="true"
        />
        <p className="text-[12px] font-semibold text-slate-200">
          {isError ? "Backend offline" : isLoading ? "Checking AI" : presentation.label}
        </p>
      </div>
      <p className="mt-1 truncate text-[11px] text-slate-400">
        {subtitle}
      </p>
      <NavLink
        to="/settings"
        className="mt-2 inline-block text-[11px] font-medium text-iris-300 hover:text-white"
      >
        Provider settings →
      </NavLink>
    </div>
  );
}

function NavItems({ mobile = false }: { mobile?: boolean }) {
  return (
    <>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-iris-400",
                mobile
                  ? "shrink-0 px-3 py-2 text-[13px]"
                  : "px-3.5 py-2.5 text-[13.5px]",
                isActive
                  ? mobile
                    ? "bg-white text-ink-900 shadow-sm"
                    : "bg-white/10 text-white"
                  : mobile
                    ? "text-ink-500 hover:text-ink-900"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </>
  );
}

export function AppShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    const pageTitle = pathname.startsWith("/quiz/")
      ? "Practice quiz"
      : navigation.find((item) => item.to === pathname)?.label;
    document.title = pageTitle
      ? `${pageTitle} · StudyLens AI`
      : "StudyLens AI — Turn your notes into understanding";
  }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-ink-950 px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo to="/dashboard" inverse />
        </div>
        <nav className="mt-9 flex flex-1 flex-col gap-1" aria-label="Primary">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
          <NavItems />
        </nav>
        <div className="mt-4">
          <SidebarStatus />
          <p className="mt-4 px-1 text-[10px] leading-4 text-slate-500">
            Single-user local build. No authentication.
          </p>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-canvas/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Logo to="/dashboard" />
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-ink-400">
              <WifiOff className="h-3 w-3" aria-hidden="true" />
              Local build
            </span>
          </div>
          <nav
            className="scroll-area flex gap-1 overflow-x-auto border-t border-ink-100 bg-ink-50/60 px-3 py-2"
            aria-label="Primary"
          >
            <NavItems mobile />
          </nav>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
