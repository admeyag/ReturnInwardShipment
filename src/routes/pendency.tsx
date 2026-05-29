import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar as CalendarIcon, Workflow, Clock, Flame, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchShipments, elapsedHours, isPending, dateKeyFromTimestamp,
  formatDateLabel, PENDENCY_WAREHOUSES, warehouseLabel,
  type Shipment, type ProcessFilter,
} from "@/lib/dashboard-data";
import { Shell } from "./index";

export const Route = createFileRoute("/pendency")({
  head: () => ({
    meta: [
      { title: "Pendency — Returns Inward Dashboard" },
      { name: "description", content: "Hourly inward & priority ageing for returns inward." },
    ],
  }),
  component: PendencyPage,
});

interface PendencyFilters {
  process: ProcessFilter;
  receivedDate: string; // "all" or yyyy-mm-dd
}

const HOURLY_COLS = [
  { key: "h0_6",   label: "0 – 6 hrs",      tint: "from-emerald-50 to-emerald-100/40", text: "text-emerald-700" },
  { key: "h6_12",  label: "6 – 12 hrs",     tint: "from-sky-50 to-sky-100/40",         text: "text-sky-700" },
  { key: "h12_18", label: "12 – 18 hrs",    tint: "from-violet-50 to-violet-100/40",   text: "text-violet-700" },
  { key: "h18_24", label: "18 – 24 hrs",    tint: "from-indigo-50 to-indigo-100/40",   text: "text-indigo-700" },
  { key: "h24_48", label: "24 – 48 hrs",    tint: "from-amber-50 to-amber-100/40",     text: "text-amber-700" },
  { key: "h48p",   label: "> 48 hrs",       tint: "from-rose-50 to-rose-100/40",       text: "text-rose-700" },
] as const;

const PRIORITY_COLS = [
  { key: "p1", label: "P1 (18+ hrs)",       chip: "bg-rose-100 text-rose-700",       sub: "Critical" },
  { key: "p2", label: "P2 (12 – 18 hrs)",   chip: "bg-orange-100 text-orange-700",   sub: "High" },
  { key: "p3", label: "P3 (6 – 12 hrs)",    chip: "bg-amber-100 text-amber-700",     sub: "Medium" },
  { key: "p4", label: "P4 (Fresh < 6 hrs)", chip: "bg-emerald-100 text-emerald-700", sub: "Fresh" },
] as const;

function localDateFromKey(key: string): Date | undefined {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
}

function PendencyPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["shipments"],
    queryFn: fetchShipments,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const [filters, setFilters] = useState<PendencyFilters>({
    process: "RVP",
    receivedDate: "all",
  });

  const rows = useMemo(() => {
    const all = data ?? [];
    return all.filter((r) => {
      if (filters.process !== "ALL" && r.type !== filters.process) return false;
      const receivedDate = dateKeyFromTimestamp(r.received_timestamp) || r.received_date;
      if (filters.receivedDate !== "all" && receivedDate !== filters.receivedDate) return false;
      if (!PENDENCY_WAREHOUSES.includes(r.warehouse_id)) return false;
      return true;
    });
  }, [data, filters]);

  const hourly = useMemo(() => buildHourly(rows), [rows]);
  const priority = useMemo(() => buildPriority(rows), [rows]);

  return (
    <Shell>
      <div className="space-y-6">
        <PendencyFiltersBar value={filters} onChange={setFilters} count={rows.length} />

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            Failed to load data.
          </div>
        )}

        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        ) : (
          <>
            <HourlyTable data={hourly} />
            <PriorityTable data={priority} />
            <RawDataTable rows={rows} />
          </>
        )}
      </div>
    </Shell>
  );
}

/* ───────── filters ───────── */

function PendencyFiltersBar({
  value, onChange, count,
}: {
  value: PendencyFilters;
  onChange: (f: PendencyFilters) => void;
  count: number;
}) {
  const dateAsDate = value.receivedDate !== "all" ? localDateFromKey(value.receivedDate) : undefined;
  const active = value.process !== "ALL" || value.receivedDate !== "all";

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-border shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white pl-3 pr-1">
          <CalendarIcon className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className={cn("h-9 w-[160px] justify-start px-2 text-sm font-medium", !dateAsDate && "text-muted-foreground")}>
                {dateAsDate ? formatDateLabel(value.receivedDate) : "All dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold">Select date</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs"
                  onClick={() => onChange({ ...value, receivedDate: "all" })}>
                  All dates
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={dateAsDate}
                onSelect={(d) => {
                  if (!d) return;
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  onChange({ ...value, receivedDate: `${y}-${m}-${day}` });
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white pl-3 pr-1">
          <Workflow className="h-3.5 w-3.5 text-violet-600" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Process</span>
          <Select value={value.process} onValueChange={(v) => onChange({ ...value, process: v as ProcessFilter })}>
            <SelectTrigger className="h-9 w-[120px] border-0 px-2 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="RTO">RTO</SelectItem>
              <SelectItem value="RVP">RVP</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {active && (
          <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground"
            onClick={() => onChange({ process: "ALL", receivedDate: "all" })}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="text-xs font-medium text-muted-foreground">
        Showing <span className="font-bold text-foreground tabular-nums">{count.toLocaleString()}</span> shipments
      </div>
    </div>
  );
}

/* ───────── compute ───────── */

interface HourlyRow {
  warehouse: string;
  h0_6: number; h6_12: number; h12_18: number; h18_24: number;
  h24_48: number; h48p: number;
  total: number;
}

function buildHourly(rows: Shipment[]): HourlyRow[] {
  const now = new Date();
  const map = new Map<string, HourlyRow>();
  PENDENCY_WAREHOUSES.forEach((w) =>
    map.set(w, { warehouse: warehouseLabel(w), h0_6: 0, h6_12: 0, h12_18: 0, h18_24: 0, h24_48: 0, h48p: 0, total: 0 })
  );

  rows.forEach((r) => {
    if (!isPending(r)) return;
    const row = map.get(r.warehouse_id);
    if (!row) return;
    row.total += 1;

    const h = elapsedHours(r, now);
    if (h < 6)        row.h0_6 += 1;
    else if (h < 12)  row.h6_12 += 1;
    else if (h < 18)  row.h12_18 += 1;
    else if (h < 24)  row.h18_24 += 1;
    else if (h < 48)  row.h24_48 += 1;
    else              row.h48p += 1;
  });

  return Array.from(map.values());
}

interface PriorityRow {
  warehouse: string;
  p1: number; p2: number; p3: number; p4: number;
  total: number;
}

function buildPriority(rows: Shipment[]): PriorityRow[] {
  const now = new Date();
  const map = new Map<string, PriorityRow>();
  PENDENCY_WAREHOUSES.forEach((w) =>
    map.set(w, { warehouse: warehouseLabel(w), p1: 0, p2: 0, p3: 0, p4: 0, total: 0 })
  );

  rows.forEach((r) => {
    if (!isPending(r)) return;
    const row = map.get(r.warehouse_id);
    if (!row) return;
    const h = elapsedHours(r, now);
    if (h >= 18) row.p1 += 1;
    else if (h >= 12) row.p2 += 1;
    else if (h >= 6) row.p3 += 1;
    else row.p4 += 1;
    row.total += 1;
  });

  return Array.from(map.values());
}

/* ───────── tables ───────── */

function HourlyTable({ data }: { data: HourlyRow[] }) {
  const totals = data.reduce(
    (a, r) => ({
      h0_6: a.h0_6 + r.h0_6, h6_12: a.h6_12 + r.h6_12, h12_18: a.h12_18 + r.h12_18,
      h18_24: a.h18_24 + r.h18_24, h24_48: a.h24_48 + r.h24_48, h48p: a.h48p + r.h48p,
      total: a.total + r.total,
    }),
    { h0_6: 0, h6_12: 0, h12_18: 0, h18_24: 0, h24_48: 0, h48p: 0, total: 0 }
  );

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-border shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-blue-50/50 to-violet-50/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-sm">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Inward Pending Count</h2>
            <p className="text-[11px] text-muted-foreground">Pending shipments by receipt hour & breach bucket</p>
          </div>
        </div>
        <span className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-border">
          Total {totals.total.toLocaleString()}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold">Warehouse</th>
              {HOURLY_COLS.map((c) => (
                <th key={c.key} className={cn("px-3 py-3 text-center font-semibold", c.text)}>{c.label}</th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.warehouse} className="border-b border-border/60 last:border-0 transition-colors hover:bg-slate-50/60">
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-bold text-slate-900">{r.warehouse}</td>
                {HOURLY_COLS.map((c) => (
                  <td key={c.key} className="px-3 py-2.5 text-center">
                    <Cell value={(r as any)[c.key]} tint={c.tint} text={c.text} />
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-900">{r.total.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/80 font-bold">
              <td className="sticky left-0 z-10 bg-slate-50/80 px-4 py-3 text-slate-900">Total</td>
              {HOURLY_COLS.map((c) => (
                <td key={c.key} className={cn("px-3 py-3 text-center tabular-nums", c.text)}>
                  {((totals as any)[c.key] as number).toLocaleString()}
                </td>
              ))}
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{totals.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PriorityTable({ data }: { data: PriorityRow[] }) {
  const totals = data.reduce(
    (a, r) => ({ p1: a.p1 + r.p1, p2: a.p2 + r.p2, p3: a.p3 + r.p3, p4: a.p4 + r.p4, total: a.total + r.total }),
    { p1: 0, p2: 0, p3: 0, p4: 0, total: 0 }
  );

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-border shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
      <header className="flex items-center justify-between border-b border-border bg-gradient-to-r from-rose-50/50 to-amber-50/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-sm">
            <Flame className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Priority Ageing Queue</h2>
            <p className="text-[11px] text-muted-foreground">Pending shipments by urgency tier</p>
          </div>
        </div>
        <span className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-border">
          Pending {totals.total.toLocaleString()}
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="sticky left-0 z-10 bg-white px-4 py-3 font-semibold">Warehouse</th>
              {PRIORITY_COLS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-center font-semibold">
                  <div className="flex flex-col items-center gap-1">
                    <span>{c.label}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold", c.chip)}>{c.sub}</span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 text-right font-semibold text-slate-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.warehouse} className="border-b border-border/60 last:border-0 transition-colors hover:bg-slate-50/60">
                <td className="sticky left-0 z-10 bg-inherit px-4 py-2.5 font-bold text-slate-900">{r.warehouse}</td>
                <td className="px-3 py-2.5 text-center"><Cell value={r.p1} tint="from-rose-50 to-rose-100/40" text="text-rose-700" /></td>
                <td className="px-3 py-2.5 text-center"><Cell value={r.p2} tint="from-orange-50 to-orange-100/40" text="text-orange-700" /></td>
                <td className="px-3 py-2.5 text-center"><Cell value={r.p3} tint="from-amber-50 to-amber-100/40" text="text-amber-700" /></td>
                <td className="px-3 py-2.5 text-center"><Cell value={r.p4} tint="from-emerald-50 to-emerald-100/40" text="text-emerald-700" /></td>
                <td className="px-4 py-2.5 text-right font-bold tabular-nums text-slate-900">{r.total.toLocaleString()}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/80 font-bold">
              <td className="sticky left-0 z-10 bg-slate-50/80 px-4 py-3 text-slate-900">Total</td>
              <td className="px-3 py-3 text-center tabular-nums text-rose-700">{totals.p1.toLocaleString()}</td>
              <td className="px-3 py-3 text-center tabular-nums text-orange-700">{totals.p2.toLocaleString()}</td>
              <td className="px-3 py-3 text-center tabular-nums text-amber-700">{totals.p3.toLocaleString()}</td>
              <td className="px-3 py-3 text-center tabular-nums text-emerald-700">{totals.p4.toLocaleString()}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-900">{totals.total.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Cell({ value, tint, text }: { value: number; tint: string; text: string }) {
  if (!value) return <span className="text-slate-300">—</span>;
  return (
    <span className={cn(
      "inline-flex min-w-[40px] items-center justify-center rounded-md bg-gradient-to-br px-2.5 py-1 text-xs font-bold tabular-nums ring-1 ring-inset ring-border/60",
      tint, text,
    )}>
      {value.toLocaleString()}
    </span>
  );
}

/* ───────── raw data ───────── */

function bucketLabel(r: Shipment, now: Date): string {
  if (!isPending(r)) return "Inwarded";
  const h = elapsedHours(r, now);
  if (h >= 48) return ">48h breached";
  if (h >= 24) return "24–48h breached";
  if (h >= 18) return "24h risk";
  if (h >= 12) return "12–18h";
  if (h >= 6) return "6–12h";
  return "0–6h";
}

function RawDataTable({ rows }: { rows: Shipment[] }) {
  const [limit, setLimit] = useState(100);
  const [pendingOnly, setPendingOnly] = useState(true);
  const [warehouse, setWarehouse] = useState<string>("all");
  const now = new Date();

  const warehouses = useMemo(
    () => Array.from(new Set(rows.map((r) => r.warehouse_id).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => {
      if (pendingOnly && !isPending(r)) return false;
      if (warehouse !== "all" && r.warehouse_id !== warehouse) return false;
      return true;
    }),
    [rows, pendingOnly, warehouse]
  );
  const visible = filtered.slice(0, limit);

  const downloadCsv = () => {
    const header = [
      "type","shipment_id","order_id","warehouse","courier","awb",
      "dispatch_date","received_timestamp","received_date","current_status",
      "ageing_hrs","bucket",
    ];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const h = elapsedHours(r, now).toFixed(2);
      lines.push([
        r.type, r.shipment_id, r.order_id, warehouseLabel(r.warehouse_id), r.courier_name,
        r.awb ?? "", r.dispatch_date, r.received_timestamp, r.received_date,
        r.current_status, h, bucketLabel(r, now),
      ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pendency_raw.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-border shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-gradient-to-r from-slate-50 to-slate-100/50 px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Raw Data</h2>
          <p className="text-[11px] text-muted-foreground">
            Underlying shipments for the counts above
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={warehouse} onValueChange={setWarehouse}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue placeholder="Warehouse" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All warehouses</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w} value={w}>{warehouseLabel(w)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => setPendingOnly((v) => !v)}
          >
            {pendingOnly ? "Pending only" : "All matched"}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={downloadCsv}>
            Download CSV
          </Button>
          <span className="rounded-md bg-white/80 px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-border">
            {filtered.length.toLocaleString()} rows
          </span>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-xs">
          <thead>
            <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Type</th>
              <th className="px-3 py-2 font-semibold">Shipment ID</th>
              <th className="px-3 py-2 font-semibold">Order ID</th>
              <th className="px-3 py-2 font-semibold">WH</th>
              <th className="px-3 py-2 font-semibold">Courier</th>
              <th className="px-3 py-2 font-semibold">AWB</th>
              <th className="px-3 py-2 font-semibold">Dispatch</th>
              <th className="px-3 py-2 font-semibold">Received Timestamp</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 text-right font-semibold">Ageing (h)</th>
              <th className="px-3 py-2 font-semibold">Bucket</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, i) => (
              <tr key={`${r.shipment_id}-${i}`} className="border-b border-border/60 last:border-0 hover:bg-slate-50/60">
                <td className="px-3 py-2 font-semibold text-slate-700">{r.type}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{r.shipment_id}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.order_id}</td>
                <td className="px-3 py-2 font-bold text-slate-900">{warehouseLabel(r.warehouse_id)}</td>
                <td className="px-3 py-2 text-slate-700">{r.courier_name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{r.awb}</td>
                <td className="px-3 py-2 text-slate-600">{r.dispatch_date}</td>
                <td className="px-3 py-2 text-slate-700">{r.received_timestamp || "—"}</td>
                <td className="px-3 py-2 text-slate-700">{r.current_status}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                  {elapsedHours(r, now).toFixed(1)}
                </td>
                <td className="px-3 py-2 text-slate-700">{bucketLabel(r, now)}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No rows.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > visible.length && (
        <div className="flex items-center justify-center border-t border-border bg-slate-50/60 px-4 py-3">
          <Button variant="outline" size="sm" className="h-8 text-xs"
            onClick={() => setLimit((l) => l + 200)}>
            Load more ({(filtered.length - visible.length).toLocaleString()} remaining)
          </Button>
        </div>
      )}
    </section>
  );
}
