import { Calendar as CalendarIcon, MapPin, Truck, Workflow, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { formatDateLabel, warehouseLabel, type Filters } from "@/lib/dashboard-data";

export function FiltersBar({
  warehouses,
  couriers,
  value,
  onChange,
  count,
  total,
}: {
  warehouses: string[];
  couriers: string[];
  value: Filters;
  onChange: (f: Filters) => void;
  count: number;
  total: number;
}) {
  const active =
    value.warehouse !== "all" ||
    value.dateFrom !== "all" ||
    value.dateTo !== "all" ||
    value.courier !== "all" ||
    value.process !== "ALL";

  const fromAsDate = value.dateFrom !== "all" ? new Date(value.dateFrom) : undefined;
  const toAsDate = value.dateTo !== "all" ? new Date(value.dateTo) : undefined;

  const toIso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-border shadow-[0_2px_8px_-2px_rgba(15,23,42,0.06)] lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date range — From */}
        <FieldShell label="From" icon={<CalendarIcon className="h-3.5 w-3.5 text-blue-600" />}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-9 w-[140px] justify-start px-2 text-sm font-medium",
                  !fromAsDate && "text-muted-foreground",
                )}
              >
                {fromAsDate ? formatDateLabel(value.dateFrom) : "All dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold">Start date</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onChange({ ...value, dateFrom: "all" })}
                >
                  Clear
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={fromAsDate}
                onSelect={(d) => {
                  if (!d) return;
                  const iso = toIso(d);
                  const next = { ...value, dateFrom: iso };
                  if (value.dateTo === "all" || iso > value.dateTo) next.dateTo = iso;
                  onChange(next);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </FieldShell>

        {/* Date range — To */}
        <FieldShell label="To" icon={<CalendarIcon className="h-3.5 w-3.5 text-blue-600" />}>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-9 w-[140px] justify-start px-2 text-sm font-medium",
                  !toAsDate && "text-muted-foreground",
                )}
              >
                {toAsDate ? formatDateLabel(value.dateTo) : "All dates"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-xs font-semibold">End date</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onChange({ ...value, dateTo: "all" })}
                >
                  Clear
                </Button>
              </div>
              <Calendar
                mode="single"
                selected={toAsDate}
                onSelect={(d) => {
                  if (!d) return;
                  const iso = toIso(d);
                  const next = { ...value, dateTo: iso };
                  if (value.dateFrom === "all" || iso < value.dateFrom) next.dateFrom = iso;
                  onChange(next);
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </FieldShell>


        {/* Process */}
        <FieldShell label="Process" icon={<Workflow className="h-3.5 w-3.5 text-violet-600" />}>
          <Select
            value={value.process}
            onValueChange={(v) => onChange({ ...value, process: v as Filters["process"] })}
          >
            <SelectTrigger className="h-9 w-[130px] border-0 px-2 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="RTO">RTO</SelectItem>
              <SelectItem value="RVP">RVP</SelectItem>
            </SelectContent>
          </Select>
        </FieldShell>

        {/* Courier */}
        <FieldShell label="Courier" icon={<Truck className="h-3.5 w-3.5 text-amber-600" />}>
          <Select
            value={value.courier}
            onValueChange={(v) => onChange({ ...value, courier: v })}
          >
            <SelectTrigger className="h-9 w-[200px] border-0 px-2 shadow-none focus:ring-0">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All couriers</SelectItem>
              {couriers.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>

        {/* Warehouse */}
        <FieldShell label="Warehouse" icon={<MapPin className="h-3.5 w-3.5 text-emerald-600" />}>
          <Select
            value={value.warehouse}
            onValueChange={(v) => onChange({ ...value, warehouse: v })}
          >
            <SelectTrigger className="h-9 w-[180px] border-0 px-2 shadow-none focus:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {warehouses.map((w) => (
                <SelectItem key={w} value={w}>{warehouseLabel(w)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>

        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1 text-muted-foreground"
            onClick={() =>
              onChange({ process: "ALL", warehouse: "all", courier: "all", dateFrom: "all", dateTo: "all" })
            }
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="text-xs font-medium text-muted-foreground">
        Showing{" "}
        <span className="font-bold text-foreground tabular-nums">{count.toLocaleString()}</span> of{" "}
        <span className="font-bold text-foreground tabular-nums">{total.toLocaleString()}</span> shipments
      </div>
    </div>
  );
}

function FieldShell({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white pl-3 pr-1">
      {icon}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
