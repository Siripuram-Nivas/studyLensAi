import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "iris" | "emerald" | "amber" | "sky";
}

const accents = {
  iris: "bg-iris-50 text-iris-700 ring-iris-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  sky: "bg-sky-50 text-sky-700 ring-sky-100",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "iris",
}: StatCardProps) {
  return (
    <div className="surface flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-500">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-ink-950">{value}</p>
        {hint && <p className="mt-1.5 text-[12px] text-ink-400">{hint}</p>}
      </div>
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", accents[accent])}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
    </div>
  );
}
