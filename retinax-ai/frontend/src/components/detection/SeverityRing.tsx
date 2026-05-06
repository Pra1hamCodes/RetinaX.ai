import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

import { severityColor } from "@/utils";

interface Props {
  severityClass: number;
  confidence: number;     // 0..1
  size?: number;
  stroke?: number;
}

export default function SeverityRing({
  severityClass,
  confidence,
  size = 220,
  stroke = 14,
}: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = useMotionValue(0);
  const dashOffset = useTransform(
    value,
    (v) => circumference * (1 - Math.min(Math.max(v, 0), 1)),
  );
  const pct = useTransform(value, (v) => `${(v * 100).toFixed(0)}%`);

  useEffect(() => {
    const controls = animate(value, confidence, { duration: 1.4, ease: "easeOut" });
    return controls.stop;
  }, [confidence, value]);

  const color = severityColor(severityClass);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1F1F1F"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span className="tabular text-4xl font-bold" style={{ color }}>
          {pct}
        </motion.span>
        <span className="mt-1 text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Confidence
        </span>
      </div>
    </div>
  );
}
