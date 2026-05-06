import { SEVERITY_LABELS } from "@/types";

export interface HistoryFilters {
  severity: number | null;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
  onReset: () => void;
}

export default function FilterBar({ filters, onChange, onReset }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-4">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        Severity
        <select
          className="rounded border border-[#1F1F1F] bg-black px-3 py-2 text-sm text-white"
          value={filters.severity ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              severity: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        >
          <option value="">All</option>
          {SEVERITY_LABELS.map((label, i) => (
            <option key={label} value={i}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        From
        <input
          type="date"
          className="rounded border border-[#1F1F1F] bg-black px-3 py-2 text-sm text-white"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        To
        <input
          type="date"
          className="rounded border border-[#1F1F1F] bg-black px-3 py-2 text-sm text-white"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
        />
      </label>

      <button
        type="button"
        onClick={onReset}
        className="ml-auto rounded border border-[#1F1F1F] px-4 py-2 text-sm text-[var(--color-muted)] hover:border-[var(--color-primary)] hover:text-white"
      >
        Reset
      </button>
    </div>
  );
}
