import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Hourglass,
  TrendingUp,
  Warehouse as WarehouseIcon,
  Truck,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  agingBuckets,
  applyFilters,
  computeDeltas,
  computeMetrics,
  courierPerformance,
  elapsedHours,
  fetchShipments,
  nearingBreach,
  PENDENCY_WAREHOUSES,
  tatDistribution,
  trendByDate,
  uniqueCouriers,
  uniqueWarehouses,
  warehouseLabel,
  warehousePerformance,
  type Filters,
  type Shipment,
} from "@/lib/dashboard-data";
import { KpiCard } from "./KpiCard";
import { Panel } from "./Panel";
import { FiltersBar } from "./FiltersBar";
import { Skeleton } from "@/components/ui/skeleton";

const CACHE_KEY = "shipments-cache-v1";
function readCache(): Shipment[] | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return undefined;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: Shipment[] };
    // Use cache up to 1 hour for instant first paint
    if (Date.now() - ts > 60 * 60_000) return undefined;
    return data;
  } catch {
    return undefined;
  }
}
function writeCache(data: Shipment[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    /* ignore quota */
  }
}

export function ShipmentDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["shipments"],
    queryFn: async () => {
      const fresh = await fetchShipments();
      writeCache(fresh);
      return fresh;
    },
    initialData: readCache,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });
  const [filters, setFilters] = useState<Filters>({
    process: "ALL",
    warehouse: "all",
    courier: "all",
    dateFrom: "all",
    dateTo: "all",
  });

  const all = useMemo(
    () => (data ?? []).filter((r) => PENDENCY_WAREHOUSES.includes(r.warehouse_id)),
    [data],
  );
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const deltas = useMemo(() => computeDeltas(all, filters), [all, filters]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        Failed to load data from Google Sheet.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FiltersBar
        warehouses={uniqueWarehouses(all)}
        couriers={uniqueCouriers(all)}
        value={filters}
        onChange={setFilters}
        count={filtered.length}
        total={all.length}
      />
      <DashboardContent rows={filtered} deltas={deltas} />
    </div>
  );
}

function deltaProps(curr: number, prev: number | undefined): { delta: string | undefined; dir: "up" | "down" | "flat" } {
  if (prev === undefined || prev === null) return { delta: undefined, dir: "flat" };
  const diff = curr - prev;
  const dir: "up" | "down" | "flat" = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  return { delta: `vs Yesterday ${prev.toLocaleString()}`, dir };
}

function DashboardContent({
  rows,
  deltas,
}: {
  rows: Shipment[];
  deltas: ReturnType<typeof computeDeltas>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white p-12 text-center">
        <p className="text-base font-semibold text-foreground">No shipments match your filters</p>
        <p className="mt-1 text-sm text-muted-foreground">Try adjusting the filters above.</p>
      </div>
    );
  }
  const m = computeMetrics(rows);
  const buckets = agingBuckets(rows.filter((r) => /pending/i.test(r.current_status)));
  const tat = tatDistribution(rows);
  const trend = trendByDate(rows);
  const warehouses = warehousePerformance(rows);
  const couriers = courierPerformance(rows);
  const breach = nearingBreach(rows);
  const y = deltas?.yest;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label="Total Return Received"
          value={m.total.toLocaleString()}
          {...renameDelta(deltaProps(m.total, y?.total))}
          icon={Box}
          tone="primary"
        />
        <KpiCard
          label="Inwarded (<24 hrs)"
          value={m.onTime.toLocaleString()}
          pct={`${m.onTimePct.toFixed(2)}%`}
          {...renameDelta(deltaProps(m.onTime, y?.onTime))}
          icon={CheckCircle2}
          tone="success"
        />
        <KpiCard
          label="Pending"
          value={m.pending.toLocaleString()}
          pct={`${m.pendingPct.toFixed(2)}%`}
          {...renameDelta(deltaProps(m.pending, y?.pending))}
          icon={Clock}
          tone="warning"
        />
        <KpiCard
          label="At Risk (>24h pending)"
          value={m.atRisk.toLocaleString()}
          pct={`${m.atRiskPct.toFixed(2)}%`}
          {...renameDelta(deltaProps(m.atRisk, y?.atRisk))}
          icon={AlertTriangle}
          tone="danger"
        />
        <KpiCard
          label="Oldest Pending Age"
          value={`${m.oldest}d`}
          pct="Max days"
          {...renameDelta(deltaProps(m.oldest, y?.oldest))}
          icon={Hourglass}
          tone="accent"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Inward TAT Performance">
          <div className="flex items-center gap-4">
            <div className="relative h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tat}
                    dataKey="value"
                    innerRadius={56}
                    outerRadius={86}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {tat.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {m.total.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
            <ul className="flex-1 space-y-3 text-sm">
              {tat.map((t) => (
                <li key={t.name} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  <div>
                    <p className="font-medium text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t.value.toLocaleString()} (
                      {m.total ? ((t.value / m.total) * 100).toFixed(2) : 0}%)
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel
          title="Return Inward Trend (Last 7 Days)"
          action={
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100">
              <TrendingUp className="h-3 w-3" /> Daily
            </span>
          }
        >
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis yAxisId="r" orientation="right" fontSize={11} stroke="var(--muted-foreground)" domain={[0, 100]} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="received" fill="#60a5fa" name="Received" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inwarded" fill="#10b981" name="Inwarded" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="pct" stroke="#7c3aed" name="Inwarded %" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Aging Bucket – Pending Shipments">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="label" fontSize={11} stroke="var(--muted-foreground)" width={88} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {buckets.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Courier + Warehouse */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <PerfTable
          title="Courier Wise Performance"
          icon={<Truck className="h-3.5 w-3.5" />}
          headerKey="Courier"
          rows={couriers.slice(0, 10).map((c) => ({
            key: c.courier,
            name: c.courier,
            received: c.received,
            sameDay: c.sameDay,
            lateInward: c.lateInward,
            sameDayPct: c.sameDayPct,
            pending: c.pending,
            atRisk: c.atRisk,
          }))}
          total={rows.length}
          totals={summarise(couriers)}
        />
        <PerfTable
          title="Warehouse Wise Performance"
          icon={<WarehouseIcon className="h-3.5 w-3.5" />}
          headerKey="Warehouse"
          rows={warehouses.slice(0, 13).map((w) => ({
            key: w.warehouse,
            name: w.warehouse,
            received: w.received,
            sameDay: w.sameDay,
            lateInward: w.lateInward,
            sameDayPct: w.sameDayPct,
            pending: w.pending,
            atRisk: w.atRisk,
          }))}
          total={rows.length}
          totals={summarise(warehouses)}
        />
      </div>

      {/* Breach list */}
      <Panel title="Shipments Nearing 24h Breach (18 – 24 hrs pending)">
        {breach.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No shipments currently at risk.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-semibold">Shipment</th>
                  <th className="pb-2 font-semibold">Courier</th>
                  <th className="pb-2 font-semibold">Warehouse</th>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Ageing</th>
                </tr>
              </thead>
              <tbody>
                {breach.map((s) => (
                  <tr key={s.shipment_id + s.order_id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 font-semibold text-foreground">{s.sr_number || s.shipment_id}</td>
                    <td className="py-2.5 text-muted-foreground">{s.courier_name}</td>
                    <td className="py-2.5 text-muted-foreground">{warehouseLabel(s.warehouse_id)}</td>
                    <td className="py-2.5">
                      <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">
                        {s.type}
                      </span>
                    </td>
                    <td className="py-2.5 text-amber-700">{s.current_status}</td>
                    <td className="py-2.5 text-right">
                      <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold tabular-nums text-amber-700 ring-1 ring-amber-100">
                        {elapsedHours(s).toFixed(1)}h
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function summarise(list: { received: number; sameDay: number; lateInward: number; pending: number; atRisk: number }[]) {
  const received = list.reduce((s, w) => s + w.received, 0);
  const sameDay = list.reduce((s, w) => s + w.sameDay, 0);
  const lateInward = list.reduce((s, w) => s + w.lateInward, 0);
  const pending = list.reduce((s, w) => s + w.pending, 0);
  const atRisk = list.reduce((s, w) => s + w.atRisk, 0);
  return {
    received, sameDay, lateInward, pending, atRisk,
    sameDayPct: received ? (sameDay / received) * 100 : 0,
  };
}

function PerfTable({
  title,
  icon,
  headerKey,
  rows,
  total,
  totals,
}: {
  title: string;
  icon: React.ReactNode;
  headerKey: string;
  rows: Array<{ key: string; name: string; received: number; sameDay: number; lateInward: number; sameDayPct: number; pending: number; atRisk: number }>;
  total: number;
  totals: { received: number; sameDay: number; lateInward: number; pending: number; atRisk: number; sameDayPct: number };
}) {
  return (
    <Panel
      title={title}
      action={
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {icon} Top {rows.length}
        </span>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="pb-2 font-semibold">{headerKey}</th>
              <th className="pb-2 text-right font-semibold">Received</th>
              <th className="pb-2 text-right font-semibold">&lt;24 hrs Inward</th>
              <th className="pb-2 text-right font-semibold">&gt;24h Inward</th>
              <th className="pb-2 text-right font-semibold">&lt;24h %</th>
              <th className="pb-2 text-right font-semibold">Pending</th>
              <th className="pb-2 text-right font-semibold">At Risk</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.key} className="border-b border-border/60 last:border-0">
                <td className="py-2.5 font-semibold text-foreground">{w.name}</td>
                <td className="py-2.5 text-right tabular-nums">{w.received.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums text-emerald-700">{w.sameDay.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums text-amber-700">{w.lateInward.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums">
                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                    w.sameDayPct >= 90
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      : w.sameDayPct >= 70
                      ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                  }`}>
                    {w.sameDayPct.toFixed(2)}%
                  </span>
                </td>
                <td className="py-2.5 text-right tabular-nums text-amber-700">{w.pending || "—"}</td>
                <td className="py-2.5 text-right tabular-nums text-rose-700">{w.atRisk || "—"}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="pt-3">Total</td>
              <td className="pt-3 text-right tabular-nums">{total.toLocaleString()}</td>
              <td className="pt-3 text-right tabular-nums text-emerald-700">{totals.sameDay.toLocaleString()}</td>
              <td className="pt-3 text-right tabular-nums text-amber-700">{totals.lateInward.toLocaleString()}</td>
              <td className="pt-3 text-right tabular-nums text-blue-700">{totals.sameDayPct.toFixed(2)}%</td>
              <td className="pt-3 text-right tabular-nums text-amber-700">{totals.pending.toLocaleString()}</td>
              <td className="pt-3 text-right tabular-nums text-rose-700">{totals.atRisk.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function renameDelta(d: { delta: string | undefined; dir: "up" | "down" | "flat" }) {
  return { delta: d.delta, deltaDir: d.dir };
}
