import { motion } from "framer-motion";

import HeatmapSlider from "@/components/detection/HeatmapSlider";
import ProbabilityBars from "@/components/detection/ProbabilityBars";
import RecommendationCard from "@/components/detection/RecommendationCard";
import SeverityRing from "@/components/detection/SeverityRing";
import SeverityBadge from "@/components/ui/SeverityBadge";
import { usePredictionStore } from "@/store/predictionStore";

export default function ResultPanel() {
  const { stage, result, error } = usePredictionStore();

  if (stage === "idle" || stage === "uploading") {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed border-[#1F1F1F] bg-[#0F0F0F] p-8 text-center">
        <span
          className="material-symbols-outlined text-[56px] text-[var(--color-muted)]"
          aria-hidden
        >
          auto_awesome
        </span>
        <h3 className="mt-4 text-lg font-semibold">Analysis results will appear here</h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Upload a clear retinal fundus image and press Analyze. The ensemble
          will return a graded severity, per-class probabilities, and a Grad-CAM
          attention map.
        </p>
      </div>
    );
  }

  if (stage === "analyzing") {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-8 text-center">
        <div className="relative h-20 w-20">
          <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-primary)] opacity-40" />
          <span className="absolute inset-3 rounded-full bg-[var(--color-primary)]" />
        </div>
        <h3 className="mt-6 text-base font-semibold uppercase tracking-widest">
          Analyzing retinal image…
        </h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">
          Running binary CNN, multiclass CNN, EfficientNet ensemble, and Grad-CAM.
        </p>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-xl border border-[var(--color-primary)] bg-[#0F0F0F] p-8 text-center">
        <span
          className="material-symbols-outlined text-[56px] text-[var(--color-primary)]"
          aria-hidden
        >
          error
        </span>
        <h3 className="mt-4 text-lg font-semibold">Analysis failed</h3>
        <p className="mt-2 max-w-md text-sm text-[var(--color-muted)]">{error}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      {result.model_version === "demo-offline" && (
        <div className="flex items-center gap-3 rounded-xl border border-[#fcd34d]/40 bg-[#231b08] px-4 py-3 text-sm text-[#fcd34d]">
          <span className="material-symbols-outlined" aria-hidden>
            cloud_off
          </span>
          <div>
            <strong className="font-semibold">Demo result</strong>
            <span className="ml-2 text-[var(--color-muted)]">
              Backend is unreachable — this prediction is a heuristic computed
              in your browser. Boot the backend to get the real ensemble verdict.
            </span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SeverityBadge
            severityClass={result.severity_class}
            label={result.severity_label}
          />
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            Model {result.model_version}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
            DR likelihood (binary gate)
          </div>
          <div className="tabular text-lg font-semibold">
            {(result.confidence_binary * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <SeverityRing
          severityClass={result.severity_class}
          confidence={result.confidence}
        />
        <div className="flex flex-col justify-center">
          <h3 className="text-2xl font-bold">{result.severity_label}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Ensemble verdict from binary, multiclass, and EfficientNet branches.
          </p>
          <div className="mt-5">
            <ProbabilityBars
              probabilities={result.probabilities}
              highlight={result.severity_class}
            />
          </div>
        </div>
      </div>

      <HeatmapSlider
        originalUrl={result.original_image_url}
        heatmapUrl={result.heatmap_url}
      />

      <RecommendationCard
        severityClass={result.severity_class}
        recommendation={result.recommendation}
      />
    </motion.div>
  );
}
