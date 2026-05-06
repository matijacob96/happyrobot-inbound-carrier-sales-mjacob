import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  Truck,
  Search as SearchIcon,
  Sun,
  Moon,
  RefreshCw,
  Wifi,
} from "lucide-react";
import { Button } from "./ui/button";
import { SettingsModal } from "./SettingsModal";
import { useTheme } from "../lib/theme";
import { useSearch } from "../lib/search";
import { cn } from "../lib/utils";

interface MainLayoutProps {
  needsSetup: boolean;
  loading: boolean;
  onRefresh: () => void;
  onSettingsSaved: () => void;
  livePolling: boolean;
}

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/calls", label: "Recent Calls", icon: PhoneCall, end: false },
  { to: "/carriers", label: "Known Carriers", icon: Users, end: false },
  { to: "/loads", label: "Loads", icon: Truck, end: false },
];

export function MainLayout({
  needsSetup,
  loading,
  onRefresh,
  onSettingsSaved,
  livePolling,
}: MainLayoutProps) {
  const { theme, toggle } = useTheme();
  const { query, setQuery } = useSearch();
  const location = useLocation();

  const placeholder = (() => {
    if (location.pathname.startsWith("/calls")) return "Search calls (MC, carrier, load…)";
    if (location.pathname.startsWith("/carriers")) return "Search carriers (MC, name…)";
    if (location.pathname.startsWith("/loads")) return "Search loads (id, lane…)";
    return "Search…";
  })();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-950/40 backdrop-blur-sm">
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-200 dark:border-white/5">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <Truck className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Acme Logistics</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
              Inbound carrier sales
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => cn("nav-link", isActive && "active")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-500 dark:text-slate-500">
          <div className="flex items-center gap-2">
            <Wifi className={cn("h-3 w-3", livePolling ? "text-emerald-500" : "text-slate-400")} />
            <span>{livePolling ? "Live · 10s" : "Idle"}</span>
          </div>
          <div className="mt-1">FDE Technical Challenge</div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-200 dark:border-white/5 bg-white/70 dark:bg-slate-950/40 backdrop-blur-sm sticky top-0 z-30">
          <div className="px-6 h-16 flex items-center gap-3">
            {/* Mobile brand */}
            <div className="md:hidden flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center">
                <Truck className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-semibold">Acme</span>
            </div>

            <div className="flex-1 max-w-xl relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-lg border border-slate-200 bg-white/80 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-400 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggle}
                aria-label="Toggle theme"
                title={theme === "dark" ? "Switch to light" : "Switch to dark"}
              >
                {theme === "dark" ? (
                  <Sun className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                Refresh
              </Button>
              <SettingsModal forceOpen={needsSetup} onSaved={onSettingsSaved} />
            </div>
          </div>

          {/* Mobile nav */}
          <nav className="md:hidden flex gap-1 px-3 pb-2 overflow-x-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn("nav-link whitespace-nowrap", isActive && "active")
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </header>

        <main className="flex-1 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 dark:text-slate-500 py-6">
          Built for the HappyRobot FDE technical challenge.
        </footer>
      </div>
    </div>
  );
}
