import { motion } from "framer-motion";

import type { ProbabilityMap } from "@/types";
import { SEVERITY_LABELS } from "@/types";
import { formatPercent, severityColor } from "@/utils";

interface Props {
  probabilities: ProbabilityMap;
  highlight: number;
}

export default function ProbabilityBars({ probabilities, highlight }: Props) {
  const values = [
    probabilities.no_dr,
    probabilities.mild,
    probabilities.moderate,
    probabilities.severe,
    probabilities.proliferative,
  ];

  return (
    <div className="flex flex-col gap-3">
      {values.map((p, i) => {
        const isHighlight = i === highlight;
        const color = severityColor(i);
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="w-32 shrink-0 text-xs uppercase tracking-wider text-[var(--color-muted)]">
              {SEVERITY_LABELS[i]}
            </div>
            <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-[#161616]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${p * 100}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 * i }}
                className="h-full rounded-full"
                style={{
                  background: color,
                  boxShadow: isHighlight ? `0 0 16px ${color}` : undefined,
                }}
              />
            </div>
            <div className="tabular w-16 shrink-0 text-right text-sm font-medium">
              {formatPercent(p, 1)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
