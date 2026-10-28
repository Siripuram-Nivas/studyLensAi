import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "info" | "success" | "warning" | "error";

const styles: Record<Variant, { wrap: string; icon: ReactNode }> = {
  info: {
    wrap: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <Info className="h-4 w-4 text-sky-600" aria-hidden="true" />,
  },
  success: {
    wrap: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />,
  },
  warning: {
    wrap: "border-amber-200 bg-amber-50 text-amber-900",
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />,
  },
  error: {
    wrap: "border-rose-200 bg-rose-50 text-rose-900",
    icon: <XCircle className="h-4 w-4 text-rose-600" aria-hidden="true" />,
  },
};

interface AlertProps {
  variant?: Variant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Alert({ variant = "info", title, children, action, className }: AlertProps) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5 text-[13px]", styles[variant].wrap, className)}
    >
      <span className="mt-0.5 shrink-0">{styles[variant].icon}</span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={title ? "mt-0.5 leading-5" : "leading-5"}>{children}</div>
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
