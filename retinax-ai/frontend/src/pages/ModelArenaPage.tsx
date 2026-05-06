import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { metricsApi } from "@/api/endpoints";
import type { AllTrainingMetricsWithSource, MetricsSource } from "@/api/endpoints";
import PageWrapper from "@/components/layout/PageWrapper";
import { SEVERITY_COLORS } from "@/types";
import type { TrainingMetrics } from "@/types";
import { cx, formatPercent } from "@/utils";

type ModelKey = "binary" | "multiclass" | "efficientnet";

interface ModelEntry {
  key: ModelKey;
  name: string;
  icon: string;
  metrics: TrainingMetrics;
}

const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#9CA3AF";
const PRIMARY = "#DC2626";

function isFlatHistory(h: TrainingMetrics["history"]): h is Record<string, number[]> {
  if (!h) return false;
  const first = Object.values(h)[0];
  return Array.isArray(first);
}

function flattenHistory(h: TrainingMetrics["history"]): {
  rows: Record<string, number>[];
  stageBoundary: number | null;
} {
  if (!h) return { rows: [], stageBoundary: null };
  if (isFlatHistory(h)) {
    const len = Math.max(...Object.values(h).map((arr) => arr.length));
    const rows: Record<string, number>[] = [];
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { epoch: i + 1 };
      for (const [k, v] of Object.entries(h)) row[k] = v[i] ?? Number.NaN;
      rows.push(row);
    }
    return { rows, stageBoundary: null };
  }

  const stages = h as Record<string, Record<string, number[]>>;
  const merged: Record<string, number>[] = [];
  let epoch = 1;
  let boundary: number | null = null;
  let stageIdx = 0;

  for (const [, body] of Object.entries(stages)) {
    const len = Math.max(...Object.values(body).map((arr) => arr.length));
    for (let i = 0; i < len; i++) {
      const row: Record<string, number> = { epoch };
      for (const [k, v] of Object.entries(body)) row[k] = v[i] ?? Number.NaN;
      merged.push(row);
      epoch += 1;
    }
    stageIdx += 1;
    if (stageIdx === 1 && Object.keys(stages).length > 1) boundary = epoch - 1;
  }

  return { rows: merged, stageBoundary: boundary };
}

function SourceBanner({ source }: { source: MetricsSource }) {
  if (source === "live") return null;
  const isDemo = source === "demo";

  return (
    <div
      className={cx(
        "rounded-xl border px-4 py-3 text-sm",
        isDemo
          ? "border-[#fcd34d]/40 bg-[#231b08] text-[#fcd34d]"
          : "border-[#1F1F1F] bg-[#0F0F0F] text-[var(--color-muted)]",
      )}
    >
      <strong className="font-semibold">{isDemo ? "Demo model arena" : "Static model arena"}</strong>
      <span className="ml-2 text-[var(--color-muted)]">
        {isDemo
          ? "Backend is offline, so this page uses illustrative comparison metrics."
          : "Using bundled metrics until live training files are available."}
      </span>
    </div>
  );
}

function metricFromMatrix(m: TrainingMetrics) {
  const matrix = m.confusion_matrix;
  const total = matrix.flat().reduce((a, b) => a + b, 0);
  const diag = matrix.reduce((acc, row, i) => acc + (row[i] ?? 0), 0);
  const recalls = matrix.map((row, i) => {
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (!rowSum) return 0;
    return (row[i] ?? 0) / rowSum;
  });
  const macroRecall = recalls.length ? recalls.reduce((a, b) => a + b, 0) / recalls.length : 0;
  return {
    total,
    diag,
    accFromMatrix: total ? diag / total : 0,
    macroRecall,
  };
}

function ConfusionMatrix({ model }: { model: ModelEntry }) {
  const matrix = model.metrics.confusion_matrix;
  const classes = model.metrics.classes ?? matrix.map((_, i) => `Class ${i}`);
  const max = Math.max(1, ...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="p-2" />
            {classes.map((c, i) => (
              <th
                key={c}
                className="p-2 text-center font-mono uppercase tracking-wider"
                style={{ color: SEVERITY_COLORS[i] ?? "#fff" }}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th className="p-2 text-left font-semibold" style={{ color: SEVERITY_COLORS[i] ?? "#fff" }}>
                {classes[i]}
              </th>
              {row.map((v, j) => {
                const intensity = v / max;
                const isDiag = i === j;
                return (
                  <td
                    key={j}
                    className={cx(
                      "tabular h-10 min-w-10 rounded text-center text-sm font-bold",
                      isDiag && "ring-1 ring-[var(--color-primary)]",
                    )}
                    style={{
                      background: `rgba(220,38,38,${(intensity * 0.92).toFixed(2)})`,
                      color: intensity > 0.45 ? "#fff" : "var(--color-muted)",
                    }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ModelArenaPage() {
  const [data, setData] = useState<AllTrainingMetricsWithSource | null>(null);
  const [selected, setSelected] = useState<ModelKey>("efficientnet");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    metricsApi
      .training()
      .then(setData)
      .catch((e) => setError(e.message ?? "Could not load model arena metrics"))
      .finally(() => setLoading(false));
  }, []);

  const models = useMemo<ModelEntry[]>(() => {
    if (!data) return [];
    const entries: Array<ModelEntry | null> = [
      data.binary ? { key: "binary", name: "Binary CNN", icon: "rule", metrics: data.binary } : null,
      data.multiclass
        ? { key: "multiclass", name: "Multiclass CNN", icon: "stairs", metrics: data.multiclass }
        : null,
      data.efficientnet
        ? { key: "efficientnet", name: "EfficientNet", icon: "auto_awesome", metrics: data.efficientnet }
        : null,
    ];
    return entries.filter((m): m is ModelEntry => Boolean(m));
  }, [data]);

  useEffect(() => {
    if (!models.length) return;
    if (!models.some((m) => m.key === selected)) {
      setSelected(models[0].key);
    }
  }, [models, selected]);

  const selectedModel = useMemo(() => models.find((m) => m.key === selected) ?? null, [models, selected]);

  const chartRows = useMemo(
    () =>
      models.map((m) => ({
        name: m.name,
        accuracy: Number((m.metrics.accuracy * 100).toFixed(2)),
        f1: Number((m.metrics.f1_weighted * 100).toFixed(2)),
        kappa: Number((m.metrics.kappa * 100).toFixed(2)),
        precision: Number((m.metrics.precision_weighted * 100).toFixed(2)),
        recall: Number((m.metrics.recall_weighted * 100).toFixed(2)),
      })),
    [models],
  );

  const radarRows = useMemo(() => {
    if (!selectedModel) return [];
    return [
      { metric: "Accuracy", value: Math.round(selectedModel.metrics.accuracy * 100) },
      { metric: "Precision", value: Math.round(selectedModel.metrics.precision_weighted * 100) },
      { metric: "Recall", value: Math.round(selectedModel.metrics.recall_weighted * 100) },
      { metric: "F1", value: Math.round(selectedModel.metrics.f1_weighted * 100) },
      { metric: "Kappa", value: Math.round(selectedModel.metrics.kappa * 100) },
    ];
  }, [selectedModel]);

  const best = useMemo(() => {
    if (!models.length) return null;
    return models.reduce((acc, m) => (m.metrics.accuracy > acc.metrics.accuracy ? m : acc));
  }, [models]);

  const curves = useMemo(() => flattenHistory(selectedModel?.metrics.history), [selectedModel]);
  const matrixStats = useMemo(() => (selectedModel ? metricFromMatrix(selectedModel.metrics) : null), [selectedModel]);

  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl px-6">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-[var(--color-primary)]">
          Performance Intelligence
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">Model Arena</h1>
        <p className="mt-4 max-w-3xl text-sm text-[var(--color-muted)]">
          A dedicated comparison cockpit for all trained models: accuracy, weighted scores, learning curves,
          confusion matrix detail, and cross-model ranking in one view.
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
          <div className="mt-8 flex flex-col gap-8">
            <SourceBanner source={data._source} />

            {best && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-[var(--color-primary)]/50 bg-[#0F0F0F] p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted)]">Arena winner</div>
                  <div className="mt-2 text-2xl font-extrabold text-[var(--color-primary)]">{best.name}</div>
                  <div className="mt-1 text-xs text-[var(--color-muted)]">Best held-out accuracy</div>
                </div>
                <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted)]">Best accuracy</div>
                  <div className="mt-2 tabular text-3xl font-extrabold">{formatPercent(best.metrics.accuracy)}</div>
                </div>
                <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted)]">Best F1</div>
                  <div className="mt-2 tabular text-3xl font-extrabold">{formatPercent(best.metrics.f1_weighted)}</div>
                </div>
                <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-5">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-[var(--color-muted)]">Models compared</div>
                  <div className="mt-2 tabular text-3xl font-extrabold">{models.length}</div>
                </div>
              </div>
            )}

            {models.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-6"
              >
                <h2 className="text-xl font-bold">Cross-Model Comparison</h2>
                <p className="mt-1 text-sm text-[var(--color-muted)]">
                  Accuracy, F1, and kappa side-by-side for rapid ranking.
                </p>
                <div className="mt-5 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartRows} margin={{ top: 8, right: 8, bottom: 8, left: -12 }}>
                      <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                      <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
                      <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 8 }}
                        formatter={(v: number) => `${v.toFixed(2)}%`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
                      <Bar dataKey="accuracy" name="Accuracy" fill="#DC2626" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="f1" name="F1 (weighted)" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="kappa" name="Kappa" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}

            {selectedModel && (
              <motion.section
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-xl font-bold">Deep Dive Studio</h2>
                  <div className="flex flex-wrap gap-2">
                    {models.map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelected(m.key)}
                        className={cx(
                          "rounded-full border px-3 py-1 text-xs uppercase tracking-wider",
                          selected === m.key
                            ? "border-[var(--color-primary)] bg-[#2a0d0d] text-white"
                            : "border-[#1F1F1F] bg-black text-[var(--color-muted)]",
                        )}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 grid gap-6 lg:grid-cols-2">
                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                      Metric profile · {selectedModel.name}
                    </h3>
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarRows}>
                          <PolarGrid stroke={GRID} />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: AXIS, fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 8 }}
                            formatter={(v: number) => `${v}%`}
                          />
                          <Radar
                            dataKey="value"
                            stroke="#DC2626"
                            fill="#DC2626"
                            fillOpacity={0.35}
                            name={selectedModel.name}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                      Confusion matrix intelligence
                    </h3>
                    <ConfusionMatrix model={selectedModel} />
                    {matrixStats && (
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-lg border border-[#1F1F1F] bg-black p-3">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Matrix acc</div>
                          <div className="tabular mt-1 text-xl font-bold">{formatPercent(matrixStats.accFromMatrix)}</div>
                        </div>
                        <div className="rounded-lg border border-[#1F1F1F] bg-black p-3">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Macro recall</div>
                          <div className="tabular mt-1 text-xl font-bold">{formatPercent(matrixStats.macroRecall)}</div>
                        </div>
                        <div className="rounded-lg border border-[#1F1F1F] bg-black p-3">
                          <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">Samples</div>
                          <div className="tabular mt-1 text-xl font-bold">{matrixStats.total.toLocaleString()}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {curves.rows.length > 0 && (
                  <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                        Accuracy curves
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={curves.rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                            <defs>
                              <linearGradient id="arena-acc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#DC2626" stopOpacity={0.45} />
                                <stop offset="100%" stopColor="#DC2626" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="arena-val-acc" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
                                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
                            <YAxis stroke={AXIS} fontSize={11} domain={[0, 1]} tickLine={false} axisLine={{ stroke: GRID }} />
                            <Tooltip
                              contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 8 }}
                              formatter={(v: number) => v.toFixed(3)}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
                            {curves.stageBoundary && (
                              <ReferenceLine x={curves.stageBoundary} stroke={PRIMARY} strokeDasharray="4 4" />
                            )}
                            <Area dataKey="accuracy" name="Train accuracy" stroke="#DC2626" fill="url(#arena-acc)" strokeWidth={2} />
                            <Area dataKey="val_accuracy" name="Val accuracy" stroke="#fff" fill="url(#arena-val-acc)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                        Loss curves
                      </h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={curves.rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                            <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
                            <XAxis dataKey="epoch" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
                            <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
                            <Tooltip
                              contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 8 }}
                              formatter={(v: number) => v.toFixed(3)}
                            />
                            <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} />
                            {curves.stageBoundary && (
                              <ReferenceLine x={curves.stageBoundary} stroke={PRIMARY} strokeDasharray="4 4" />
                            )}
                            <Line dataKey="loss" name="Train loss" stroke="#DC2626" dot={false} strokeWidth={2} />
                            <Line dataKey="val_loss" name="Val loss" stroke="#fff" dot={false} strokeWidth={2} strokeDasharray="6 4" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {!models.length && (
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-12 text-center">
                <span className="material-symbols-outlined text-[40px]" style={{ color: PRIMARY }} aria-hidden>
                  analytics
                </span>
                <h3 className="mt-3 text-xl font-bold">No trained model metrics yet</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Run training scripts, then refresh this page to activate the full comparison arena.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
