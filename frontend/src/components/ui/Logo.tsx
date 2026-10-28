import { Link } from "react-router-dom";
import { ScanEye } from "lucide-react";
import { cn } from "../../lib/cn";

interface LogoProps {
  to?: string;
  compact?: boolean;
  inverse?: boolean;
}

export function Logo({ to = "/", compact = false, inverse = false }: LogoProps) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-iris-400"
      aria-label="StudyLens AI home"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-iris-600 text-white shadow-sm">
        <ScanEye className="h-5 w-5" aria-hidden="true" />
      </span>
      {!compact && (
        <span className={cn("text-[17px] font-bold tracking-tight", inverse ? "text-white" : "text-ink-950")}>
          StudyLens <span className="text-iris-500">AI</span>
        </span>
      )}
    </Link>
  );
}
