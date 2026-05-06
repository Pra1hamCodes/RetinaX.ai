import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

const GRID = "rgba(255,255,255,0.06)";
const AXIS = "#9CA3AF";
const PRIMARY = "#DC2626";
const ACCENT = "#FFFFFF";

// ─────────────────────────────────────────────────────────────────────────────
// History flattening
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Reusable subcomponents
// ─────────────────────────────────────────────────────────────────────────────

function SourceBanner({ source }: { source: MetricsSource }) {
  if (source === "live") return null;
  const isDemo = source === "demo";
  return (
    <div
      className={cx(
        "flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm",
        isDemo
          ? "border-[#fcd34d]/40 bg-[#231b08] text-[#fcd34d]"
          : "border-[#1F1F1F] bg-[#0F0F0F] text-[var(--color-muted)]",
      )}
    >
      <span className="material-symbols-outlined" aria-hidden>
        {isDemo ? "science" : "info"}
      </span>
      <div className="flex-1">
        <strong className="font-semibold">
          {isDemo ? "Demo metrics" : "Static metrics"}
        </strong>
        <span className="ml-2 text-[var(--color-muted)]">
          {isDemo
            ? "Backend is offline — showing illustrative numbers from /static-metrics.json. Run training to see real results."
            : "Reading bundled metrics. Live API will replace these when the backend is reachable."}
        </span>
      </div>
      <code className="hidden rounded bg-black px-2 py-1 text-xs md:inline">
        python -m ml.training.train_multiclass
      </code>
    </div>
  );
}

function TopMetricCard({
  label,
  value,
  trend,
  intent,
}: {
  label: string;
  value: string;
  trend?: string;
  intent: "primary" | "ok" | "muted";
}) {
  const ring =
    intent === "primary"
      ? "border-[var(--color-primary)]/50"
      : intent === "ok"
        ? "border-emerald-500/30"
        : "border-[#1F1F1F]";
  const accent = intent === "primary" ? "var(--color-primary)" : "#FFFFFF";
  return (
    <div className={cx("rounded-xl border bg-[#0F0F0F] p-5", ring)}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-muted)]">
        {label}
      </div>
      <div className="tabular mt-2 text-3xl font-extrabold" style={{ color: accent }}>
        {value}
      </div>
      {trend && <div className="mt-1 text-xs text-[var(--color-muted)]">{trend}</div>}
    </div>
  );
}

function ConfusionMatrix({
  matrix,
  classes,
}: {
  matrix: number[][];
  classes: string[];
}) {
  const max = Math.max(1, ...matrix.flat());
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-xs">
        <thead>
          <tr>
            <th className="p-2"></th>
            {classes.map((c, i) => (
              <th
                key={c}
                className="p-2 text-center font-mono uppercase tracking-wider"
                style={{ color: SEVERITY_COLORS[i] }}
              >
                {c.toUpperCase()}
              </th>
            ))}
            <th className="p-2 text-right font-mono text-[10px] uppercase tracking-wider text-[var(--color-muted)]">
              Σ
            </th>
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <th
                className="p-2 text-left text-xs font-semibold uppercase tracking-wider"
                style={{ color: SEVERITY_COLORS[i] }}
              >
                {classes[i]}
              </th>
              {row.map((v, j) => {
                const intensity = v / max;
                const isDiag = i === j;
                return (
                  <td
                    key={j}
                    className={cx(
                      "tabular relative h-12 w-12 rounded-md text-center text-sm font-bold",
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
              <td className="tabular px-2 text-right text-[var(--color-muted)]">
                {rowSums[i]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-muted)]">
        <span>Rows: actual class · columns: predicted class</span>
        <span className="ml-auto inline-flex items-center gap-2">
          Low
          <span
            className="inline-block h-2 w-24 rounded-full"
            style={{
              background:
                "linear-gradient(to right, rgba(220,38,38,0.05), rgba(220,38,38,0.95))",
            }}
          />
          High
        </span>
      </div>
    </div>
  );
}

function MetricsTable({ metrics }: { metrics: AllTrainingMetricsWithSource }) {
  const rows = [
    { name: "Binary CNN", icon: "rule", m: metrics.binary },
    { name: "Multiclass CNN", icon: "stairs", m: metrics.multiclass },
    { name: "EfficientNet", icon: "auto_awesome", m: metrics.efficientnet },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-[#1F1F1F]">
      <table className="w-full text-sm">
        <thead className="bg-[#0F0F0F] text-left text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted)]">
          <tr>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Accuracy</th>
            <th className="px-4 py-3">Precision</th>
            <th className="px-4 py-3">Recall</th>
            <th className="px-4 py-3">F1</th>
            <th className="px-4 py-3">Quadratic κ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1F1F1F] bg-black">
          {rows.map(({ name, icon, m }) => (
            <tr key={name}>
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: "var(--color-primary)" }}
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <span className="font-semibold">{name}</span>
                </div>
              </td>
              {m ? (
                <>
                  <td className="tabular px-4 py-3">{formatPercent(m.accuracy)}</td>
                  <td className="tabular px-4 py-3">{formatPercent(m.precision_weighted)}</td>
                  <td className="tabular px-4 py-3">{formatPercent(m.recall_weighted)}</td>
                  <td className="tabular px-4 py-3">{formatPercent(m.f1_weighted)}</td>
                  <td className="tabular px-4 py-3">{m.kappa.toFixed(3)}</td>
                </>
              ) : (
                <td className="px-4 py-3 text-xs text-[var(--color-muted)]" colSpan={5}>
                  Not yet trained
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryAccChart({ rows, stageBoundary }: { rows: Record<string, number>[]; stageBoundary: number | null }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="acc-train" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.45} />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="acc-val" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
            <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey="epoch" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} fontSize={11} domain={[0, 1]} tickLine={false} axisLine={{ stroke: GRID }} />
        <Tooltip
          contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 6 }}
          labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
          formatter={(v: number) => v.toFixed(3)}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
        {stageBoundary && (
          <ReferenceLine
            x={stageBoundary}
            stroke={PRIMARY}
            strokeDasharray="4 4"
            label={{ value: "Unfreeze", position: "top", fill: PRIMARY, fontSize: 10 }}
          />
        )}
        <Area
          type="monotone"
          dataKey="accuracy"
          name="Train accuracy"
          stroke={PRIMARY}
          strokeWidth={2}
          fill="url(#acc-train)"
          isAnimationActive
        />
        <Area
          type="monotone"
          dataKey="val_accuracy"
          name="Val accuracy"
          stroke={ACCENT}
          strokeWidth={2}
          fill="url(#acc-val)"
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function HistoryLossChart({ rows, stageBoundary }: { rows: Record<string, number>[]; stageBoundary: number | null }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey="epoch" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <Tooltip
          contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 6 }}
          labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
          formatter={(v: number) => v.toFixed(3)}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
        {stageBoundary && (
          <ReferenceLine x={stageBoundary} stroke={PRIMARY} strokeDasharray="4 4" />
        )}
        <Line
          type="monotone"
          dataKey="loss"
          name="Train loss"
          stroke={PRIMARY}
          dot={false}
          strokeWidth={2}
        />
        <Line
          type="monotone"
          dataKey="val_loss"
          name="Val loss"
          stroke={ACCENT}
          dot={false}
          strokeWidth={2}
          strokeDasharray="6 4"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function RocChart({ roc, classes }: { roc: NonNullable<TrainingMetrics["roc"]>; classes: string[] }) {
  const lines = useMemo(
    () =>
      Object.entries(roc).map(([cls, body]) => ({
        cls: Number(cls),
        label: classes[Number(cls)] ?? `Class ${cls}`,
        auc: body.auc,
        data: body.fpr.map((x, i) => ({ x, y: body.tpr[i] })),
      })),
    [roc, classes],
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="x"
          stroke={AXIS}
          fontSize={11}
          domain={[0, 1]}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          label={{ value: "False positive rate", position: "insideBottom", offset: -2, fill: AXIS, fontSize: 10 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          stroke={AXIS}
          fontSize={11}
          domain={[0, 1]}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <Tooltip
          contentStyle={{ background: "#0F0F0F", border: "1px solid #1F1F1F", borderRadius: 6 }}
          labelStyle={{ color: "#9CA3AF", fontSize: 11 }}
          formatter={(v: number) => v.toFixed(3)}
        />
        <Legend wrapperStyle={{ fontSize: 11, color: "#9CA3AF" }} />
        {/* Reference diagonal */}
        <Line
          data={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
          dataKey="y"
          stroke="rgba(255,255,255,0.18)"
          dot={false}
          strokeDasharray="3 3"
          name="Random"
          isAnimationActive={false}
        />
        {lines.map((d) => (
          <Line
            key={d.cls}
            data={d.data}
            dataKey="y"
            stroke={SEVERITY_COLORS[d.cls] ?? "#fff"}
            strokeWidth={2.5}
            dot={false}
            name={`${d.label} · AUC ${d.auc.toFixed(2)}`}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function ModelCard({ name, icon, metrics }: { name: string; icon: string; metrics: TrainingMetrics }) {
  const { rows, stageBoundary } = flattenHistory(metrics.history);
  const classes = metrics.classes ?? [];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#1F1F1F] pb-4">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined text-[28px]"
            style={{ color: "var(--color-primary)" }}
            aria-hidden
          >
            {icon}
          </span>
          <div>
            <h3 className="text-2xl font-bold">{name}</h3>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              Test set · {metrics.confusion_matrix.flat().reduce((a, b) => a + b, 0).toLocaleString()} samples
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-[#1F1F1F] bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            ACC {formatPercent(metrics.accuracy)}
          </span>
          <span className="rounded-full border border-[#1F1F1F] bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
            F1 {formatPercent(metrics.f1_weighted)}
          </span>
          <span
            className="rounded-full border bg-black px-3 py-1 font-mono text-[10px] uppercase tracking-widest"
            style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
          >
            κ {metrics.kappa.toFixed(3)}
          </span>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h4 className="text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Accuracy curves
              </h4>
              <span className="font-mono text-[10px] text-[var(--color-muted)]">{rows.length} epochs</span>
            </div>
            <div className="h-72">
              <HistoryAccChart rows={rows} stageBoundary={stageBoundary} />
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              Loss curves
            </h4>
            <div className="h-72">
              <HistoryLossChart rows={rows} stageBoundary={stageBoundary} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
            Confusion matrix
          </h4>
          <ConfusionMatrix matrix={metrics.confusion_matrix} classes={classes} />
        </div>
        {metrics.roc && Object.keys(metrics.roc).length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-widest text-[var(--color-muted)]">
              ROC · per class
            </h4>
            <div className="h-72">
              <RocChart roc={metrics.roc} classes={classes} />
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  const [data, setData] = useState<AllTrainingMetricsWithSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    metricsApi
      .training()
      .then(setData)
      .catch((e) => setError(e.message ?? "Could not load metrics"))
      .finally(() => setLoading(false));
  }, []);

  const headline = useMemo(() => {
    if (!data) return null;
    const candidates = [data.efficientnet, data.multiclass, data.binary].filter(
      (m): m is TrainingMetrics => Boolean(m),
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, m) => (m.accuracy > best.accuracy ? m : best));
  }, [data]);

  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl px-6">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-[var(--color-primary)]">
          Performance · Diagnostic Suite
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">Model Evaluation</h1>
        <p className="mt-4 max-w-2xl text-sm text-[var(--color-muted)]">
          Numbers come from the JSON files written by{" "}
          <code className="rounded bg-[#0F0F0F] px-1 py-0.5">train_*.py</code>. Train, then refresh —
          the live metrics replace the bundled fallback automatically.
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

            {headline && (
              <div className="grid gap-4 md:grid-cols-4">
                <TopMetricCard
                  label="Best accuracy"
                  value={formatPercent(headline.accuracy)}
                  trend="Top-line model on the held-out set"
                  intent="primary"
                />
                <TopMetricCard
                  label="Best κ (quadratic)"
                  value={headline.kappa.toFixed(3)}
                  trend="Agreement with expert grading"
                  intent="ok"
                />
                <TopMetricCard
                  label="Best F1 (weighted)"
                  value={formatPercent(headline.f1_weighted)}
                  trend="Class-balanced harmonic mean"
                  intent="muted"
                />
                <TopMetricCard
                  label="Models trained"
                  value={`${[data.binary, data.multiclass, data.efficientnet].filter(Boolean).length}/3`}
                  trend="Binary · multiclass · EfficientNet"
                  intent="muted"
                />
              </div>
            )}

            <MetricsTable metrics={data} />

            {data.binary && <ModelCard name="Binary CNN" icon="rule" metrics={data.binary} />}
            {data.multiclass && (
              <ModelCard name="Multiclass CNN" icon="stairs" metrics={data.multiclass} />
            )}
            {data.efficientnet && (
              <ModelCard name="EfficientNet" icon="auto_awesome" metrics={data.efficientnet} />
            )}

            {!data.binary && !data.multiclass && !data.efficientnet && (
              <div className="rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-12 text-center">
                <span
                  className="material-symbols-outlined text-[40px]"
                  style={{ color: "var(--color-primary)" }}
                  aria-hidden
                >
                  rocket_launch
                </span>
                <h3 className="mt-3 text-xl font-bold">No metrics on disk yet</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">
                  Run any of the training scripts inside the backend container, then refresh.
                </p>
                <code className="mt-4 inline-block rounded bg-black px-3 py-2 text-xs">
                  docker compose exec backend python -m ml.training.train_multiclass
                </code>
              </div>
            )}
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
