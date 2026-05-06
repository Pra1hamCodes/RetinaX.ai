import { motion } from "framer-motion";

import HeatmapSlider from "@/components/detection/HeatmapSlider";
import ProbabilityBars from "@/components/detection/ProbabilityBars";
import SeverityRing from "@/components/detection/SeverityRing";
import SeverityBadge from "@/components/ui/SeverityBadge";
import type { PredictionRecord } from "@/types";
import { formatRelativeDate } from "@/utils";

interface Props {
  record: PredictionRecord;
  onClose: () => void;
}

export default function PredictionModal({ record, onClose }: Props) {
  const probs = record.probabilities;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-8"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-2 text-[var(--color-muted)] hover:bg-black hover:text-white"
          aria-label="Close"
        >
          <span className="material-symbols-outlined" aria-hidden>
            close
          </span>
        </button>

        <div className="flex flex-wrap items-center gap-4">
          <SeverityBadge
            severityClass={record.severity_class}
            label={record.severity_label}
          />
          <span className="text-sm text-[var(--color-muted)]">
            {formatRelativeDate(record.created_at)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            Model {record.model_version}
          </span>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr]">
          <SeverityRing
            severityClass={record.severity_class}
            confidence={Math.max(
              probs.no_dr,
              probs.mild,
              probs.moderate,
              probs.severe,
              probs.proliferative,
            )}
          />
          <div className="flex flex-col justify-center">
            <h3 className="text-2xl font-bold">{record.severity_label}</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              Persisted ensemble verdict from your previous analysis.
            </p>
            <div className="mt-5">
              <ProbabilityBars
                probabilities={record.probabilities}
                highlight={record.severity_class}
              />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <HeatmapSlider
            originalUrl={record.original_image_url}
            heatmapUrl={record.heatmap_url}
          />
        </div>
      </motion.div>
    </div>
  );
}
