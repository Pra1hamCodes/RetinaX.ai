import { cx } from "@/utils";

interface Props {
  severityClass: number;
  label: string;
  className?: string;
}

const BG = ["bg-sev-0", "bg-sev-1", "bg-sev-2", "bg-sev-3", "bg-sev-4"];

export default function SeverityBadge({ severityClass, label, className }: Props) {
  const bg = BG[severityClass] ?? "bg-sev-0";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider",
        bg,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label}
    </span>
  );
}
