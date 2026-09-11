import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import chargeGuardLogo from "@/076db99a-04d1-4fe0-b3ac-4208548fbfa4.jpeg";
import type { Metrics } from "@/types/chargeguard";

function StatusBadge() {
  const { t } = useLanguage();

  return (
    <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
      <span className="relative flex size-2.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
      </span>
      <span className="text-xs font-semibold text-emerald-700 sm:text-sm">{t.app.activeAgent}</span>
    </div>
  );
}

function DataSourceBadge({ apiError }: { apiError?: string | null }) {
  const { language } = useLanguage();

  if (env.dataSource === "mock") {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
        <span className="size-2 rounded-full bg-slate-400" />
        <span>{language === "es" ? "Demo Mock" : "Demo Mock"}</span>
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
        <span className="size-2 rounded-full bg-red-500" />
        <span>{language === "es" ? "Mock (API caída)" : "Mock (API down)"}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
      </span>
      <span>{language === "es" ? "API en Vivo (AWS)" : "Live API (AWS)"}</span>
    </div>
  );
}

type AppLayoutProps = {
  activeCaseId?: string | null;
  metrics?: Metrics;
  apiError?: string | null;
};

function NavTabs({ activeCaseId, onNavigate }: { activeCaseId?: string | null; onNavigate?: () => void }) {
  const { t } = useLanguage();
  const timelineHref = activeCaseId ? `/disputes/${activeCaseId}` : "/disputes";
  const navItems = [
    { label: t.nav.dashboard, href: "/", icon: Bot },
    { label: t.nav.subscriptions, href: "/subscriptions", icon: ShieldCheck },
    { label: t.nav.timeline, href: timelineHref, icon: AlertTriangle },
  ];

  return (
    <nav className="flex flex-col gap-2 lg:flex-row lg:items-center">
      {navItems.map((item) => (
        <NavLink
          className={({ isActive }) =>
            cn(
              "flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900",
              isActive && "bg-slate-900 text-white hover:bg-slate-900 hover:text-white",
            )
          }
          end={item.href === "/"}
          key={item.href}
          onClick={onNavigate}
          to={item.href}
        >
          <item.icon className="size-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppLayout({ activeCaseId, metrics, apiError }: AppLayoutProps = {}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useLanguage();
  const totalRecoveredFormatted = metrics ? `$${metrics.total_recovered_usd.toFixed(2)}` : "$42.50";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white p-1 shadow-sm sm:size-12">
              <img
                alt="ChargeGuard shield logo"
                className="max-h-full max-w-full object-contain"
                src={chargeGuardLogo}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-lg font-extrabold leading-5 text-slate-900">ChargeGuard</p>
              <p className="mt-1 hidden text-xs font-semibold uppercase text-slate-500 sm:block">{t.app.subtitle}</p>
              <div className="mt-1 hidden sm:block">
                <StatusBadge />
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-4 lg:flex">
            <NavTabs activeCaseId={activeCaseId} />
            <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">{t.app.recovered}: {totalRecoveredFormatted}</span>
            </div>
            <LanguageSwitcher />
            <DataSourceBadge apiError={apiError} />
          </div>

          <Button aria-label={t.app.toggleNavigation} className="lg:hidden" onClick={() => setMenuOpen((current) => !current)} size="icon" variant="outline">
            <Bot />
          </Button>
        </div>

        <div className="border-t border-slate-100 px-4 pb-3 sm:hidden">
          <StatusBadge />
        </div>

        {menuOpen ? (
          <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
            <div className="mx-auto max-w-7xl space-y-4">
              <NavTabs activeCaseId={activeCaseId} onNavigate={() => setMenuOpen(false)} />
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">{t.app.recovered}: {totalRecoveredFormatted}</span>
              </div>
              <LanguageSwitcher />
              <DataSourceBadge apiError={apiError} />
            </div>
          </div>
        ) : null}
      </header>

      <main>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
