import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient, useIsFetching, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  LayoutDashboard,
  ListTodo,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Download,
  Activity,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShipmentDashboard } from "@/components/dashboard/ShipmentDashboard";
import { cn } from "@/lib/utils";
import purplleLogo from "@/assets/purplle-logo.png";
import {
  fetchShipments,
  computeMetrics,
  PENDENCY_WAREHOUSES,
  warehouseLabel,
  todayDateKey,
  type Shipment,
} from "@/lib/dashboard-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Returns Inward Dashboard — Performance" },
      {
        name: "description",
        content:
          "Real-time RTO and RVP returns inward performance — TAT, aging, courier-wise and warehouse-wise metrics.",
      },
    ],
  }),
  component: Index,
});

const navSections = [
  {
    label: "Dashboards",
    items: [
      {
        to: "/",
        label: "Performance",
        icon: LayoutDashboard,
        tint: "from-violet-500 to-purple-600",
        soft: "bg-violet-50 text-violet-600",
      },
      {
        to: "/pendency",
        label: "Pendency",
        icon: ListTodo,
        tint: "from-fuchsia-500 to-pink-600",
        soft: "bg-fuchsia-50 text-fuchsia-600",
      },
    ],
  },
] as const;

function Index() {
  return (
    <Shell>
      <ShipmentDashboard />
    </Shell>
  );
}

/* ---------- CSV export helper ---------- */
function exportToCsv(rows: Shipment[]) {
  if (!rows.length) return;
  const headers = [
    "type", "order_id", "shipment_id", "warehouse", "courier_name",
    "sr_number", "awb", "dispatch_date", "received_date", "received_timestamp",
    "current_status", "ageing",
  ];
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        r.type, r.order_id, r.shipment_id, warehouseLabel(r.warehouse_id),
        r.courier_name, r.sr_number ?? "", r.awb ?? "", r.dispatch_date,
        r.received_date, r.received_timestamp, r.current_status, r.ageing,
      ].map(escape).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `returns-inward-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fetching = useIsFetching({ queryKey: ["shipments"] }) > 0;

  // Sidebar state (persist)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sb_collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("sb_collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Live data for header chips (shares cache with dashboard)
  const { data } = useQuery({
    queryKey: ["shipments"],
    queryFn: fetchShipments,
    staleTime: 5 * 60_000,
  });
  const today = todayDateKey();
  const summary = useMemo(() => {
    const allRows = (data ?? []).filter((r) => PENDENCY_WAREHOUSES.includes(r.warehouse_id));
    const rows = allRows.filter((r) => r.received_date === today);
    if (!allRows.length) return { total: 0, atRisk: 0, pending: 0, rto: 0, rvp: 0 };
    const m = computeMetrics(rows);
    return {
      total: rows.length,
      atRisk: m.atRisk,
      pending: m.pending,
      rto: rows.filter((r) => r.type === "RTO").length,
      rvp: rows.filter((r) => r.type === "RVP").length,
    };
  }, [data, today]);

  const refreshedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
  const pageTitle = path === "/pendency" ? "Pendency" : "Performance";

  const handleExport = () => {
    const rows = (data ?? []).filter((r) => PENDENCY_WAREHOUSES.includes(r.warehouse_id));
    exportToCsv(rows);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(1100px_550px_at_-10%_-10%,#ede9fe_0%,transparent_55%),radial-gradient(1000px_500px_at_110%_0%,#fae8ff_0%,transparent_55%),radial-gradient(900px_500px_at_50%_120%,#fce7f3_0%,transparent_60%),linear-gradient(180deg,#faf8ff_0%,#f3eefc_100%)]">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200/60 bg-white/75 backdrop-blur-2xl transition-[width] duration-300 md:flex",
            collapsed ? "w-[76px]" : "w-[260px]",
          )}
        >
          {/* Brand */}
          <div className={cn(
            "flex items-center gap-3 border-b border-slate-200/60 py-5",
            collapsed ? "justify-center px-3" : "px-5",
          )}>
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-400 via-fuchsia-500 to-purple-600 opacity-50 blur-lg" />
              <div className={cn(
                "relative grid place-items-center rounded-2xl bg-white shadow-md ring-1 ring-slate-200",
                collapsed ? "h-12 w-12" : "h-16 w-16",
              )}>
                <img src={purplleLogo} alt="Purplle" className={cn("object-contain", collapsed ? "h-10 w-10" : "h-14 w-14")} />
              </div>
            </div>
            {!collapsed && (
              <div className="leading-tight">
                <p className="text-[18px] font-extrabold tracking-tight text-slate-900">Purplle</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">
                  Return Inward
                </p>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
            {navSections.map((sec) => (
              <div key={sec.label}>
                {!collapsed && (
                  <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {sec.label}
                  </p>
                )}
                <div className="space-y-1">
                  {sec.items.map((item) => {
                    const active = path === item.to;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                          collapsed && "justify-center px-0",
                          active
                            ? "bg-white text-slate-900 shadow-[0_4px_20px_-6px_rgba(20,184,166,0.3)] ring-1 ring-slate-200"
                            : "text-slate-600 hover:bg-white/70 hover:text-slate-900 hover:translate-x-0.5",
                        )}
                      >
                        {active && !collapsed && (
                          <span className={cn("absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b", item.tint)} />
                        )}
                        <span
                          className={cn(
                            "grid h-9 w-9 place-items-center rounded-lg transition-transform group-hover:scale-110 group-hover:rotate-3",
                            active ? `bg-gradient-to-br ${item.tint} text-white shadow-md` : item.soft,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        {!collapsed && <span className="flex-1">{item.label}</span>}
                        {!collapsed && active && <ChevronRight className="h-4 w-4 text-slate-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Today's load snapshot */}
            {!collapsed && (
              <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 p-4 text-white shadow-lg ring-1 ring-white/10 relative">
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-90">Today's load</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">{summary.total.toLocaleString()}</p>
                <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold">
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur">RTO {summary.rto.toLocaleString()}</span>
                  <span className="rounded-md bg-white/20 px-1.5 py-0.5 backdrop-blur">RVP {summary.rvp.toLocaleString()}</span>
                </div>
              </div>
            )}
          </nav>

          {/* Footer toggle */}
          <div className="border-t border-slate-200/60 p-3">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn(
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900",
                collapsed && "justify-center",
              )}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/75 backdrop-blur-2xl">
            <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  onClick={() => setCollapsed((c) => !c)}
                  className="hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 hover:scale-105 active:scale-95 md:inline-flex"
                  title="Toggle sidebar"
                >
                  {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                </button>

                <div className="hidden flex-col md:flex">
                  <nav className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <span>Returns</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>Dashboards</span>
                  </nav>
                  <h1 className="-mt-0.5 text-lg font-extrabold tracking-tight text-slate-900">
                    {pageTitle}
                  </h1>
                </div>
              </div>

              {/* Center search */}
              <div className="hidden flex-1 justify-center lg:flex">
                <div className="group relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition group-focus-within:text-violet-500" />
                  <input
                    type="text"
                    placeholder="Search shipment, AWB, courier…"
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white/80 pl-9 pr-16 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                  <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">
                    ⌘K
                  </kbd>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Export */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExport}
                  className="hidden h-9 gap-1.5 rounded-xl border-slate-200 bg-white px-3 text-slate-700 transition hover:bg-slate-50 hover:scale-105 active:scale-95 sm:inline-flex"
                  disabled={!data?.length}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">Export</span>
                </Button>

                <div className="mr-1 hidden text-right xl:block">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Last refreshed
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-slate-700">{refreshedAt}</p>
                </div>

                <Button
                  size="sm"
                  onClick={() => qc.invalidateQueries({ queryKey: ["shipments"] })}
                  className="h-9 gap-1.5 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 px-3 text-white shadow-md shadow-purple-500/25 transition hover:opacity-95 hover:shadow-lg hover:scale-105 active:scale-95"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
                  <span className="text-xs font-semibold">Refresh</span>
                </Button>
              </div>
            </div>

            {/* Stat strip */}
            <div className="flex items-center gap-2 overflow-x-auto border-t border-slate-100 px-4 py-2 md:px-6">
              <StatPill icon={<Activity className="h-3 w-3" />} label="Total" value={summary.total.toLocaleString()} tone="violet" />
              <StatPill label="Pending" value={summary.pending.toLocaleString()} tone="amber" />
              <StatPill icon={<Zap className="h-3 w-3" />} label="At Risk" value={summary.atRisk.toLocaleString()} tone="rose" />
              <StatPill label="RTO" value={summary.rto.toLocaleString()} tone="purple" />
              <StatPill label="RVP" value={summary.rvp.toLocaleString()} tone="fuchsia" />
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

function StatPill({
  icon, label, value, tone,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  tone: "violet" | "amber" | "rose" | "purple" | "fuchsia";
}) {
  const map = {
    violet: "bg-violet-50 text-violet-700 ring-violet-100 hover:bg-violet-100",
    amber:  "bg-amber-50 text-amber-700 ring-amber-100 hover:bg-amber-100",
    rose:   "bg-rose-50 text-rose-700 ring-rose-100 hover:bg-rose-100",
    purple: "bg-purple-50 text-purple-700 ring-purple-100 hover:bg-purple-100",
    fuchsia:"bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-100 hover:bg-fuchsia-100",
  };
  return (
    <div className={cn("inline-flex shrink-0 cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition hover:scale-105", map[tone])}>
      {icon}
      <span className="opacity-70">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
