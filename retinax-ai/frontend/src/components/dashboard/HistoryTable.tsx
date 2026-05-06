import SeverityBadge from "@/components/ui/SeverityBadge";
import type { PredictionRecord } from "@/types";
import { formatPercent, formatRelativeDate, resolveStorageUrl } from "@/utils";

interface Props {
  rows: PredictionRecord[];
  onView: (row: PredictionRecord) => void;
  onDelete: (row: PredictionRecord) => void;
}

export default function HistoryTable({ rows, onView, onDelete }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#1F1F1F] bg-[#0F0F0F] p-12 text-center text-[var(--color-muted)]">
        No predictions yet. Run an analysis to populate this table.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#1F1F1F]">
      <table className="w-full text-sm">
        <thead className="bg-[#0F0F0F] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">Scan</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Severity</th>
            <th className="px-4 py-3">DR likelihood</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F1F1F] bg-black">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-[#0F0F0F]">
              <td className="px-4 py-3">
                <div className="h-12 w-12 overflow-hidden rounded border border-[#1F1F1F] bg-[#0F0F0F]">
                  <img
                    src={resolveStorageUrl(row.original_image_url)}
                    alt="thumbnail"
                    className="h-full w-full object-cover"
                  />
                </div>
              </td>
              <td className="px-4 py-3 text-[var(--color-muted)]">
                {formatRelativeDate(row.created_at)}
              </td>
              <td className="px-4 py-3">
                <SeverityBadge
                  severityClass={row.severity_class}
                  label={row.severity_label}
                />
              </td>
              <td className="tabular px-4 py-3">{formatPercent(row.confidence_binary)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onView(row)}
                  className="rounded border border-[#1F1F1F] px-3 py-1 text-xs hover:border-[var(--color-primary)]"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  className="ml-2 rounded border border-[#1F1F1F] px-3 py-1 text-xs text-[var(--color-primary)] hover:bg-[#1a0a0a]"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
