import { forwardRef } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "../../lib/cn";

const controlClasses =
  "w-full rounded-xl border bg-white text-sm text-ink-900 shadow-sm transition-colors placeholder:text-ink-400 focus:border-iris-400 focus:outline-none focus:ring-4 focus:ring-iris-100 disabled:cursor-not-allowed disabled:bg-ink-50";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-800">
          {label}
          {optional && <span className="ml-1 font-normal text-ink-400">(optional)</span>}
        </label>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} role="alert" className="text-[12px] font-medium text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          controlClasses,
          "h-11 px-3.5",
          props["aria-invalid"] ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-ink-200",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        controlClasses,
        "min-h-32 resize-y px-3.5 py-3 leading-6",
        props["aria-invalid"] ? "border-rose-300 focus:border-rose-400 focus:ring-rose-100" : "border-ink-200",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlClasses, "h-11 border-ink-200 px-3.5", className)}
      {...props}
    >
      {children}
    </select>
  );
});
