import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

type Tone = "primary" | "success" | "warning" | "danger" | "accent";

interface KpiCardProps {
  label: string;
  value: string | number;
  pct?: string;
  delta?: string;
  deltaDir?: "up" | "down" | "flat";
  icon: LucideIcon;
  tone: Tone;
}

const toneStyles: Record<
  Tone,
  {
    gradient: string;
    glow: string;
    valueText: string;
    bar: string;
    ringHover: string;
    softBg: string;
    chipBg: string;
    chipText: string;
  }
> = {
  primary: {
    gradient: "from-blue-500 via-indigo-500 to-violet-600",
    glow: "shadow-[0_10px_30px_-12px_rgba(79,70,229,0.55)]",
    valueText: "text-indigo-700",
    bar: "from-blue-400 via-indigo-500 to-violet-600",
    ringHover: "group-hover:ring-indigo-200",
    softBg: "from-blue-100/70 via-indigo-50/60 to-violet-100/50",
    chipBg: "bg-indigo-50",
    chipText: "text-indigo-700",
  },
  success: {
    gradient: "from-emerald-400 via-teal-500 to-cyan-600",
    glow: "shadow-[0_10px_30px_-12px_rgba(16,185,129,0.55)]",
    valueText: "text-emerald-700",
    bar: "from-emerald-400 via-teal-500 to-cyan-600",
    ringHover: "group-hover:ring-emerald-200",
    softBg: "from-emerald-100/70 via-teal-50/60 to-cyan-100/50",
    chipBg: "bg-emerald-50",
    chipText: "text-emerald-700",
  },
  warning: {
    gradient: "from-amber-400 via-orange-500 to-yellow-500",
    glow: "shadow-[0_10px_30px_-12px_rgba(245,158,11,0.55)]",
    valueText: "text-amber-700",
    bar: "from-amber-400 via-orange-500 to-yellow-500",
    ringHover: "group-hover:ring-amber-200",
    softBg: "from-amber-100/70 via-orange-50/60 to-yellow-100/50",
    chipBg: "bg-amber-50",
    chipText: "text-amber-700",
  },
  danger: {
    gradient: "from-rose-500 via-pink-500 to-red-600",
    glow: "shadow-[0_10px_30px_-12px_rgba(244,63,94,0.55)]",
    valueText: "text-rose-700",
    bar: "from-rose-500 via-pink-500 to-red-600",
    ringHover: "group-hover:ring-rose-200",
    softBg: "from-rose-100/70 via-pink-50/60 to-red-100/50",
    chipBg: "bg-rose-50",
    chipText: "text-rose-700",
  },
  accent: {
    gradient: "from-violet-500 via-fuchsia-500 to-pink-600",
    glow: "shadow-[0_10px_30px_-12px_rgba(168,85,247,0.55)]",
    valueText: "text-violet-700",
    bar: "from-violet-500 via-fuchsia-500 to-pink-600",
    ringHover: "group-hover:ring-violet-200",
    softBg: "from-violet-100/70 via-fuchsia-50/60 to-pink-100/50",
    chipBg: "bg-violet-50",
    chipText: "text-violet-700",
  },
};

export function KpiCard({ label, value, pct, delta, deltaDir = "flat", icon: Icon, tone }: KpiCardProps) {
  const s = toneStyles[tone];
  const DeltaIcon = deltaDir === "up" ? ArrowUpRight : deltaDir === "down" ? ArrowDownRight : null;
  const deltaColor =
    deltaDir === "up" ? "text-emerald-600" : deltaDir === "down" ? "text-rose-600" : "text-slate-500";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white via-white p-5 ring-1 ring-slate-200/70",
        "shadow-[0_4px_14px_-4px_rgba(15,23,42,0.08)] transition-all duration-300",
        "hover:-translate-y-1.5 hover:scale-[1.015] hover:shadow-[0_24px_55px_-22px_rgba(15,23,42,0.3)]",
        s.ringHover,
      )}
    >
      {/* Soft gradient wash (stronger) */}
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-90", s.softBg)} />
      {/* Decorative blurred blob */}
      <div
        className={cn(
          "pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br opacity-30 blur-3xl transition-all duration-500 group-hover:opacity-60 group-hover:scale-125",
          s.gradient,
        )}
      />
      {/* Secondary bottom blob */}
      <div
        className={cn(
          "pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-gradient-to-tr opacity-15 blur-2xl transition-opacity duration-500 group-hover:opacity-30",
          s.gradient,
        )}
      />
      {/* Top accent bar */}
      <span className={cn("absolute left-0 right-0 top-0 h-1.5 bg-gradient-to-r", s.bar)} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
          <p
            className={cn(
              "mt-3 text-[36px] font-extrabold leading-none tracking-tight tabular-nums drop-shadow-sm",
              s.valueText,
            )}
          >
            {value}
          </p>
          {pct && (
            <span
              className={cn(
                "mt-3 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums ring-1 ring-inset ring-white/60",
                s.chipBg,
                s.chipText,
              )}
            >
              {pct}
            </span>
          )}
          {delta && (
            <p className={cn("mt-2 flex items-center gap-1 text-[11px] font-semibold", deltaColor)}>
              {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
              {delta}
            </p>
          )}
        </div>
        <div
          className={cn(
            "relative grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white transition-all duration-300 group-hover:scale-110 group-hover:rotate-6",
            s.gradient,
            s.glow,
          )}
        >
          <Icon className="h-8 w-8 drop-shadow-md" strokeWidth={2.25} />
          <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/40" />
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/0 via-white/20 to-white/0" />
        </div>
      </div>
    </div>
  );
}
