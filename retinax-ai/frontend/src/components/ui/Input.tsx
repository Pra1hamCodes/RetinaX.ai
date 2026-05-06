import { forwardRef, type InputHTMLAttributes } from "react";

import { cx } from "@/utils";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        ref={ref}
        {...rest}
        className={cx(
          "w-full rounded-md border bg-[#0F0F0F] px-3 py-2 text-sm transition-colors",
          "border-[#1F1F1F] focus:border-[var(--color-primary)]",
          error && "border-[var(--color-primary)]",
          className,
        )}
      />
      {error ? (
        <span className="text-xs text-[var(--color-primary)]">{error}</span>
      ) : hint ? (
        <span className="text-xs text-[var(--color-muted)]">{hint}</span>
      ) : null}
    </div>
  );
});
export default Input;
