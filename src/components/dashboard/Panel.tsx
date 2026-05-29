import { cn } from "@/lib/utils";

export function Panel({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-white/95 p-5 ring-1 ring-slate-200/70",
        "shadow-[0_2px_10px_-2px_rgba(15,23,42,0.06)] transition-all duration-300",
        "hover:shadow-[0_18px_45px_-20px_rgba(99,102,241,0.25)] hover:ring-indigo-200/60",
        className,
      )}
    >
      {/* subtle gradient corner */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-to-br from-indigo-100/60 via-violet-100/40 to-transparent blur-2xl opacity-70" />
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-700">
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            {title}
          </span>
        </h3>
        {action}
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}
