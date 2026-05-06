import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { metricsApi } from "@/api/endpoints";
import type { DatasetStatsWithSource } from "@/api/endpoints";
import PageWrapper from "@/components/layout/PageWrapper";
import { SEVERITY_COLORS } from "@/types";
import { formatPercent } from "@/utils";

export default function DatasetPage() {
  const [data, setData] = useState<DatasetStatsWithSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    metricsApi
      .dataset()
      .then(setData)
      .catch((e) => setError(e.message ?? "Could not load dataset stats"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <PageWrapper>
      <div className="mx-auto max-w-6xl px-6">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
          Provenance
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">
          The Dataset
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--color-muted)]">
          We trained against the publicly licensed APTOS 2019 Blindness Detection
          corpus on Kaggle — colour fundus photographs graded by expert
          ophthalmologists on the standard 0–4 severity scale.
        </p>

        {loading && (
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-[#1F1F1F] bg-[#0F0F0F]" />
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="mt-10 rounded-xl border border-[var(--color-primary)] bg-[#1a0a0a] p-6 text-sm text-[var(--color-primary)]">
            {error}
          </div>
        )}

        {data && (
          <>
            {data._source !== "live" && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] px-4 py-3 text-sm text-[var(--color-muted)]">
                <span className="material-symbols-outlined" aria-hidden>
                  inventory_2
                </span>
                <span>
                  Showing real on-disk counts (computed from <code className="rounded bg-black px-1 py-0.5">dataset/colored_images/</code>).
                  Live API will replace these once the backend is reachable.
                </span>
              </div>
            )}

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  Total images
                </div>
                <div className="tabular mt-2 text-3xl font-bold">{data.total.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  Train · Val · Test
                </div>
                <div className="tabular mt-2 text-3xl font-bold">
                  {(data.split_ratio.train * 100).toFixed(0)} ·{" "}
                  {(data.split_ratio.val * 100).toFixed(0)} ·{" "}
                  {(data.split_ratio.test * 100).toFixed(0)}
                </div>
              </div>
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  Image size
                </div>
                <div className="tabular mt-2 text-3xl font-bold">
                  {data.image_size}×{data.image_size}
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
              <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Class distribution
              </div>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.classes}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F" }}
                      formatter={(v) => [v, "Images"]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {data.classes.map((_, i) => (
                        <Cell key={i} fill={SEVERITY_COLORS[i] ?? "#DC2626"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
                {data.classes.map((c, i) => (
                  <div key={c.label} className="rounded border border-[#1F1F1F] bg-black p-3">
                    <div
                      className="text-xs uppercase tracking-widest"
                      style={{ color: SEVERITY_COLORS[i] }}
                    >
                      {c.label}
                    </div>
                    <div className="tabular mt-1 text-lg font-semibold">{c.count}</div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {formatPercent(c.percentage / 100, 1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
                <h3 className="text-lg font-semibold">CLAHE preprocessing</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  Contrast-Limited Adaptive Histogram Equalization on the L*
                  channel boosts vessel and microaneurysm visibility without
                  amplifying global brightness — critical for catching mild DR.
                </p>
              </div>
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
                <h3 className="text-lg font-semibold">Augmentation</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  Rotations, horizontal flips, and class-balanced sampling during
                  training compensate for the long tail (Severe and Proliferative
                  DR are under-represented).
                </p>
              </div>
            </div>

            <div className="mt-10 text-xs text-[var(--color-muted)]">
              Source: <span className="text-white">{data.source}</span>
            </div>
          </>
        )}
      </div>
    </PageWrapper>
  );
}
