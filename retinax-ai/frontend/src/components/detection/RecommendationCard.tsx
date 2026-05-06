import { severityColor } from "@/utils";

interface Props {
  severityClass: number;
  recommendation: string;
}

export default function RecommendationCard({ severityClass, recommendation }: Props) {
  const color = severityColor(severityClass);
  return (
    <div
      className="flex gap-4 rounded-xl border bg-[#0F0F0F] p-4"
      style={{ borderColor: color }}
    >
      <span
        className="material-symbols-outlined mt-0.5 text-[24px]"
        style={{ color }}
        aria-hidden
      >
        medical_information
      </span>
      <div>
        <div className="text-xs font-semibold uppercase tracking-widest" style={{ color }}>
          Clinical Recommendation
        </div>
        <p className="mt-1 text-sm leading-relaxed">{recommendation}</p>
      </div>
    </div>
  );
}
