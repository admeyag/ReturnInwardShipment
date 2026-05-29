import Papa from "papaparse";

export const RVP_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRfhyr_fXaTHFiQoIP1k1XEWWZAISFkw-tBSaC43exV_-7L_BbWAtFD8fQzpEAO3t1mIPcPU2yreUH7/pub?gid=173112168&single=true&output=csv";

export const RTO_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vspf9vW02-TTcGpPGXNPd6EGYHOoM93Zseg75sMo7yw/gviz/tq?tqx=out:csv&sheet=Extract%202";

export type ShipmentType = "RTO" | "RVP";
export type ProcessFilter = "ALL" | ShipmentType;

export interface Shipment {
  type: ShipmentType;
  order_id: string;
  shipment_id: string;
  warehouse_id: string;
  awb?: string;
  sr_number?: string;
  status_changed_to?: string;
  tenant?: string;
  courier_name: string;
  dispatch_date: string;
  received_timestamp: string;
  received_date: string; // dd-mm-yyyy or d/m/yyyy
  current_status: string;
  closed_timestamp?: string;
  ageing: number;
}

export const SLA: Record<ShipmentType, { onTime: number; atRiskFrom: number }> = {
  RVP: { onTime: 2, atRiskFrom: 1 },
  RTO: { onTime: 3, atRiskFrom: 2 },
};

function stripCommas(v: string): string {
  return String(v ?? "").replace(/,/g, "").trim();
}
function num(v: string): number {
  return Number(stripCommas(v)) || 0;
}

// Normalise dd-mm-yyyy OR d/m/yyyy => yyyy-mm-dd for comparison + ISO key
export function normaliseDate(d: string): string {
  if (!d) return "";
  const parts = d.replace(/\//g, "-").split("-").map((x) => x.trim());
  if (parts.length !== 3) return d;
  const [dd, mm, yyyy] = parts;
  return `${yyyy.padStart(4, "20")}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}
export function formatDateLabel(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

export function dateKeyFromTimestamp(ts: string): string {
  const s = String(ts ?? "");
  const m = s.match(/(\d{1,2})([/-])(\d{1,2})[/-](\d{2,4})/);
  if (!m) return "";
  const a = parseInt(m[1], 10);
  const sep = m[2];
  const b = parseInt(m[3], 10);
  // "-" separator → D-M-Y (Indian / RTO sheet). "/" → M/D/Y (RVP sheet).
  let day: number, month: number;
  if (a > 12) { day = a; month = b; }
  else if (b > 12) { month = a; day = b; }
  else if (sep === "-") { day = a; month = b; }
  else { month = a; day = b; }
  const year = m[4].length === 2 ? `20${m[4]}` : m[4].padStart(4, "20");
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch sheet");
  const text = await res.text();
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return parsed.data;
}

export async function fetchShipments(): Promise<Shipment[]> {
  const [rvpRaw, rtoRaw] = await Promise.all([
    fetchCsv(RVP_SHEET_URL),
    fetchCsv(RTO_SHEET_URL),
  ]);

  const rvp: Shipment[] = rvpRaw.map((r) => {
    const recv = r.recieved ?? r.received ?? r.received_timestamp ?? "";
    const closed = r.closed ?? r.closed_timestamp ?? "";
    return {
      type: "RVP",
      order_id: stripCommas(r.order_id),
      shipment_id: stripCommas(r.shipment_id),
      warehouse_id: stripCommas(r.warehouse_id),
      awb: stripCommas(r.awb),
      sr_number: r.sr_number ?? "",
      status_changed_to: r.status_changed_to ?? "",
      tenant: r.tenant ?? "",
      courier_name: (r.courier_name ?? "").trim() || "Unknown",
      dispatch_date: r.dispatch_date ?? "",
      received_timestamp: recv,
      received_date: dateKeyFromTimestamp(recv) || normaliseDate(r.received_date ?? ""),
      current_status: r.current_status ?? "",
      closed_timestamp: closed,
      ageing: num(r.ageing),
    };
  });

  const rto: Shipment[] = rtoRaw.map((r) => {
    const recv = r.rto_receive_time_ist ?? r.received ?? r.recieved ?? r.received_timestamp ?? "";
    const inward = r.rto_inward_time_ist ?? r.closed_timestamp ?? r.closed ?? "";
    const recDate = parseTimestamp(recv);
    const inwDate = inward ? parseTimestamp(inward) : null;
    const ageingDays = recDate
      ? Math.max(0, Math.floor((((inwDate ?? new Date()).getTime() - recDate.getTime()) / 86_400_000)))
      : 0;
    return {
      type: "RTO",
      order_id: stripCommas(r.order_id ?? r.shipment_id),
      shipment_id: stripCommas(r.shipment_id),
      warehouse_id: stripCommas(r.warehouse_id),
      tenant: r.tenant ?? "",
      status_changed_to: r.status_changed_to ?? "",
      courier_name: (r.carrier_name ?? r.courier_name ?? "").trim() || "Unknown",
      dispatch_date: r.dispatch_date ?? "",
      received_timestamp: recv,
      received_date: dateKeyFromTimestamp(recv) || normaliseDate(r.received_date ?? ""),
      current_status: inward ? "CLOSED" : "PENDING",
      closed_timestamp: inward,
      ageing: ageingDays,
    };
  });

  return [...rvp, ...rto].filter((r) => r.shipment_id || r.order_id);
}

// Parse "18/5/2026, 12:30 PM" or "18-05-2026 12:30" → Date
export function parseTimestamp(ts: string): Date | null {
  if (!ts) return null;
  const m = ts.match(/(\d{1,2})([/-])(\d{1,2})[/-](\d{2,4})[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const sep = m[2];
  const b = parseInt(m[3], 10);
  let day: number, mo: number;
  if (a > 12) { day = a; mo = b; }
  else if (b > 12) { mo = a; day = b; }
  else if (sep === "-") { day = a; mo = b; }
  else { mo = a; day = b; }
  const y = parseInt(m[4].length === 2 ? "20" + m[4] : m[4], 10);
  let hr = parseInt(m[5], 10);
  const mi = parseInt(m[6], 10);
  const sc = m[7] ? parseInt(m[7], 10) : 0;
  const ap = (m[8] || "").toUpperCase();
  if (ap === "PM" && hr < 12) hr += 12;
  if (ap === "AM" && hr === 12) hr = 0;
  return new Date(y, mo - 1, day, hr, mi, sc);
}

// Hours from received_timestamp → closed (if inwarded) or now (if pending)
export function elapsedHours(r: Shipment, now: Date = new Date()): number {
  const rec = parseTimestamp(r.received_timestamp);
  if (!rec) return r.ageing * 24;
  const end = isInwarded(r) && r.closed_timestamp
    ? parseTimestamp(r.closed_timestamp) ?? now
    : now;
  return Math.max(0, (end.getTime() - rec.getTime()) / 36e5);
}

// Fixed display sequence: MUM, GGN, BLR, CCU, GUA, LKO, MAA, HYD, COK, VJA, CJB, PAT, BBI
export const PENDENCY_WAREHOUSES = [
  "2", "4", "10", "12", "16", "21", "25", "28", "29", "40", "42", "45", "47",
];

export const WAREHOUSE_NAMES: Record<string, string> = {
  "2": "MUM", "4": "GGN", "10": "BLR", "12": "CCU", "16": "GUA",
  "21": "LKO", "25": "MAA", "28": "HYD", "29": "COK", "40": "VJA",
  "42": "CJB", "45": "PAT", "47": "BBI",
};
export function warehouseLabel(id: string): string {
  return WAREHOUSE_NAMES[id] ?? id;
}
export function warehouseSortIndex(id: string): number {
  const i = PENDENCY_WAREHOUSES.indexOf(id);
  return i === -1 ? 9999 : i;
}
export function warehouseSortIndexByLabel(label: string): number {
  const id = Object.entries(WAREHOUSE_NAMES).find(([, l]) => l === label)?.[0];
  return id ? warehouseSortIndex(id) : 9999;
}

// Today's IST date key (yyyy-mm-dd)
export function todayDateKey(): string {
  const now = new Date();
  // IST = UTC+5:30
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60_000);
  const y = ist.getFullYear();
  const m = String(ist.getMonth() + 1).padStart(2, "0");
  const d = String(ist.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface Filters {
  process: ProcessFilter;
  warehouse: string;
  courier: string;
  dateFrom: string; // "all" or yyyy-mm-dd
  dateTo: string;   // "all" or yyyy-mm-dd
}

export function applyFilters(rows: Shipment[], f: Filters): Shipment[] {
  return rows.filter((r) => {
    if (f.process !== "ALL" && r.type !== f.process) return false;
    if (f.warehouse !== "all" && r.warehouse_id !== f.warehouse) return false;
    if (f.courier !== "all" && r.courier_name !== f.courier) return false;
    if (f.dateFrom !== "all" && r.received_date < f.dateFrom) return false;
    if (f.dateTo !== "all" && r.received_date > f.dateTo) return false;
    return true;
  });
}

export function uniqueWarehouses(rows: Shipment[]): string[] {
  return Array.from(new Set(rows.map((r) => r.warehouse_id).filter(Boolean))).sort(
    (a, b) => Number(a) - Number(b),
  );
}
export function uniqueCouriers(rows: Shipment[]): string[] {
  return Array.from(new Set(rows.map((r) => r.courier_name).filter(Boolean))).sort();
}
export function uniqueReceiveDates(rows: Shipment[]): string[] {
  return Array.from(new Set(rows.map((r) => r.received_date).filter(Boolean))).sort(
    (a, b) => b.localeCompare(a),
  );
}

export function isInwarded(r: Shipment): boolean {
  return /closed|inwarded/i.test(r.current_status);
}
export function isPending(r: Shipment): boolean {
  return /pending/i.test(r.current_status);
}

export interface Metrics {
  total: number;
  onTime: number;
  pending: number;
  atRisk: number;
  oldest: number;
  onTimePct: number;
  pendingPct: number;
  atRiskPct: number;
}

export function computeMetrics(rows: Shipment[]): Metrics {
  const total = rows.length;
  const onTime = rows.filter((r) => isInwarded(r) && elapsedHours(r) < 24).length;
  const pending = rows.filter(isPending).length;
  const atRisk = rows.filter((r) => isPending(r) && elapsedHours(r) >= 24).length;
  const oldest = rows.filter(isPending).reduce((m, r) => Math.max(m, r.ageing), 0);
  return {
    total, onTime, pending, atRisk, oldest,
    onTimePct: total ? (onTime / total) * 100 : 0,
    pendingPct: total ? (pending / total) * 100 : 0,
    atRiskPct: total ? (atRisk / total) * 100 : 0,
  };
}

// Compare current vs previous-day for delta tags on KPI cards
export function computeDeltas(allRows: Shipment[], filters: Filters) {
  // If a specific date is selected, compare against the day before
  // Otherwise compare latest date vs the one before
  const allDates = uniqueReceiveDates(allRows); // sorted desc
  if (allDates.length === 0) return null;
  const anchor = filters.dateFrom !== "all" ? filters.dateFrom : allDates[0];
  const idx = allDates.indexOf(anchor);
  const yesterdayDate = idx >= 0 && idx + 1 < allDates.length ? allDates[idx + 1] : null;
  if (!yesterdayDate) return null;
  const todayDate = anchor;

  const partialFilter = (date: string) =>
    applyFilters(allRows, { ...filters, dateFrom: date, dateTo: date });

  const today = computeMetrics(partialFilter(todayDate));
  const yest = computeMetrics(partialFilter(yesterdayDate));
  return { today, yest, todayDate, yesterdayDate };
}

export const AGE_BUCKETS = [
  { label: "0 – 1 day", min: 0, max: 1, color: "var(--success)" },
  { label: "1 – 3 days", min: 1, max: 3, color: "var(--info)" },
  { label: "3 – 7 days", min: 3, max: 7, color: "var(--warning)" },
  { label: "7 – 30 days", min: 7, max: 30, color: "var(--accent)" },
  { label: "> 30 days", min: 30, max: Infinity, color: "var(--danger)" },
];

export function agingBuckets(rows: Shipment[]) {
  return AGE_BUCKETS.map((b) => ({
    ...b,
    count: rows.filter((r) => r.ageing >= b.min && r.ageing < b.max).length,
  }));
}

export function tatDistribution(rows: Shipment[]) {
  let within = 0, mid = 0, breach = 0, pending = 0;
  rows.forEach((r) => {
    if (!isInwarded(r)) {
      if (isPending(r)) pending += 1;
      return;
    }
    const h = elapsedHours(r);
    if (h < 24) within += 1;
    else if (h < 48) mid += 1;
    else breach += 1;
  });
  return [
    { name: "Inwarded < 24 hrs", value: within, color: "var(--success)" },
    { name: "Inwarded 24 - 48 hrs", value: mid, color: "var(--warning)" },
    { name: "Inwarded > 48 hrs", value: breach, color: "var(--danger)" },
    { name: "Still Pending", value: pending, color: "var(--muted-foreground)" },
  ];
}

export function trendByDate(rows: Shipment[]) {
  const map = new Map<string, { received: number; inwarded: number }>();
  rows.forEach((r) => {
    const d = r.received_date || "—";
    const cur = map.get(d) ?? { received: 0, inwarded: 0 };
    cur.received += 1;
    if (isInwarded(r)) cur.inwarded += 1;
    map.set(d, cur);
  });
  return Array.from(map.entries())
    .map(([date, v]) => ({
      date: formatDateLabel(date).replace(/ \d{4}$/, ""),
      _key: date,
      received: v.received,
      inwarded: v.inwarded,
      pct: v.received ? Math.round((v.inwarded / v.received) * 100) : 0,
    }))
    .sort((a, b) => a._key.localeCompare(b._key))
    .slice(-7);
}

export function warehousePerformance(rows: Shipment[]) {
  const map = new Map<string, Shipment[]>();
  rows.forEach((r) => {
    const arr = map.get(r.warehouse_id) ?? [];
    arr.push(r);
    map.set(r.warehouse_id, arr);
  });
  return Array.from(map.entries())
    .map(([wh, list]) => {
      const received = list.length;
      const inwardedList = list.filter(isInwarded);
      const inwarded = inwardedList.length;
      const sameDay = inwardedList.filter((r) => elapsedHours(r) < 24).length;
      const lateInward = inwarded - sameDay;
      const pending = list.filter(isPending).length;
      const atRisk = list.filter((r) => isPending(r) && elapsedHours(r) >= 24).length;
      return {
        warehouse: warehouseLabel(wh),
        received,
        inwarded,
        sameDay,
        lateInward,
        pct: received ? (inwarded / received) * 100 : 0,
        sameDayPct: received ? (sameDay / received) * 100 : 0,
        pending,
        atRisk,
      };
    })
    .sort((a, b) => warehouseSortIndexByLabel(a.warehouse) - warehouseSortIndexByLabel(b.warehouse));
}

export function courierPerformance(rows: Shipment[]) {
  const map = new Map<string, Shipment[]>();
  rows.forEach((r) => {
    const arr = map.get(r.courier_name) ?? [];
    arr.push(r);
    map.set(r.courier_name, arr);
  });
  return Array.from(map.entries())
    .map(([courier, list]) => {
      const received = list.length;
      const inwardedList = list.filter(isInwarded);
      const inwarded = inwardedList.length;
      const sameDay = inwardedList.filter((r) => elapsedHours(r) < 24).length;
      const lateInward = inwarded - sameDay;
      const pending = list.filter(isPending).length;
      const atRisk = list.filter((r) => isPending(r) && elapsedHours(r) >= 24).length;
      return {
        courier,
        received,
        inwarded,
        sameDay,
        lateInward,
        pct: received ? (inwarded / received) * 100 : 0,
        sameDayPct: received ? (sameDay / received) * 100 : 0,
        pending,
        atRisk,
      };
    })
    .sort((a, b) => b.received - a.received);
}

export function nearingBreach(rows: Shipment[]) {
  return rows
    .filter((r) => {
      if (!isPending(r)) return false;
      const h = elapsedHours(r);
      return h >= 18 && h < 24;
    })
    .sort((a, b) => elapsedHours(b) - elapsedHours(a))
    .slice(0, 8);
}
