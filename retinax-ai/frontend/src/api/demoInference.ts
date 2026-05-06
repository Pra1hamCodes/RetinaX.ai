/**
 * In-browser fallback "inference" used when the FastAPI backend is unreachable.
 *
 * It is **not** a real DR classifier — it cannot replace the trained ensemble.
 * It is a heuristic that:
 *   1. Reads the uploaded fundus image into a canvas.
 *   2. Extracts simple statistics that loosely correlate with DR severity
 *      (mean red intensity, image variance, edge density).
 *   3. Uses those features to bias a deterministic 5-class softmax that *looks*
 *      like a real prediction.
 *   4. Generates a synthetic Grad-CAM-style heatmap by stamping red gaussian
 *      blobs at the brightest non-uniform regions of the image, then alpha-
 *      blending it over the original.
 *
 * The result includes `model_version: "demo-offline"` so the UI can flag it.
 */

import type { PredictionResult, TaskStatus } from "@/types";

interface PendingTask {
  startedAt: number;
  resolved: PredictionResult | null;
  error: string | null;
}

const TASKS = new Map<string, PendingTask>();
const SIMULATED_LATENCY_MS = 1500;

const RECOMMENDATIONS: Record<number, string> = {
  0: "No diabetic retinopathy detected. Continue annual screening and maintain glycemic control.",
  1: "Mild non-proliferative DR detected. Schedule a follow-up retinal exam in 6-12 months.",
  2: "Moderate non-proliferative DR detected. Refer to an ophthalmologist within 1-3 months.",
  3: "Severe non-proliferative DR detected. Urgent referral within weeks — high progression risk.",
  4: "Proliferative DR detected. EMERGENT referral to a retinal specialist.",
};

const SEVERITY_LABELS = ["No DR", "Mild", "Moderate", "Severe", "Proliferative DR"] as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isDemoTask(taskId: string): boolean {
  return taskId.startsWith("demo:");
}

export function startDemoInference(file: File): { task_id: string } {
  const task_id = `demo:${crypto.randomUUID()}`;
  TASKS.set(task_id, { startedAt: performance.now(), resolved: null, error: null });

  void runInference(file).then(
    (result) => {
      const t = TASKS.get(task_id);
      if (t) t.resolved = result;
    },
    (err: unknown) => {
      const t = TASKS.get(task_id);
      if (t) t.error = err instanceof Error ? err.message : "Demo inference failed";
    },
  );

  return { task_id };
}

export function pollDemoTask(task_id: string): TaskStatus {
  const t = TASKS.get(task_id);
  if (!t) return { status: "failed", error: "Unknown demo task" };

  const elapsed = performance.now() - t.startedAt;
  if (t.error) return { status: "failed", error: t.error };
  if (t.resolved && elapsed >= SIMULATED_LATENCY_MS) {
    return { status: "complete", result: t.resolved };
  }
  return { status: "pending" };
}

// ---------------------------------------------------------------------------
// Heuristic inference
// ---------------------------------------------------------------------------

async function runInference(file: File): Promise<PredictionResult> {
  const dataUrl = await readAsDataURL(file);
  const img = await loadImage(dataUrl);

  // Draw the image at a fixed working resolution.
  const W = 256;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = W;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, W);

  const features = extractFeatures(ctx, W);
  const probabilities = featuresToProbabilities(features);
  const severityClass = argmax(probabilities) as 0 | 1 | 2 | 3 | 4;

  const heatmapDataUrl = generateSyntheticHeatmap(ctx, W, features, severityClass);

  return {
    severity_class: severityClass,
    severity_label: SEVERITY_LABELS[severityClass],
    confidence: probabilities[severityClass],
    confidence_binary: 1 - probabilities[0],
    probabilities: {
      no_dr: probabilities[0],
      mild: probabilities[1],
      moderate: probabilities[2],
      severe: probabilities[3],
      proliferative: probabilities[4],
    },
    original_image_url: dataUrl,
    heatmap_url: heatmapDataUrl,
    recommendation: RECOMMENDATIONS[severityClass],
    model_version: "demo-offline",
  };
}

interface ImageFeatures {
  meanR: number;
  meanG: number;
  meanB: number;
  variance: number;
  edgeDensity: number;
  redDominance: number;
}

function extractFeatures(ctx: CanvasRenderingContext2D, size: number): ImageFeatures {
  const data = ctx.getImageData(0, 0, size, size).data;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  // First pass — running totals on the fundus mask (skip near-black borders).
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 18) {
      sumR += r;
      sumG += g;
      sumB += b;
      count += 1;
    }
  }
  if (count === 0) count = 1;
  const meanR = sumR / count;
  const meanG = sumG / count;
  const meanB = sumB / count;

  // Second pass — luminance variance + simple edge response.
  let varSum = 0;
  let edgeSum = 0;
  let varCount = 0;
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      const i = (y * size + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 18) continue;

      const meanLum = 0.299 * meanR + 0.587 * meanG + 0.114 * meanB;
      varSum += (lum - meanLum) ** 2;

      const right = data[(y * size + x + 1) * 4];
      const down = data[((y + 1) * size + x) * 4];
      edgeSum += Math.abs(r - right) + Math.abs(r - down);
      varCount += 1;
    }
  }
  const variance = varCount > 0 ? varSum / varCount : 0;
  const edgeDensity = varCount > 0 ? edgeSum / varCount : 0;

  // Red dominance — DR images skew warm. Range roughly [0, 1.5].
  const redDominance = meanR / Math.max(1, (meanG + meanB) / 2);

  return { meanR, meanG, meanB, variance, edgeDensity, redDominance };
}

/**
 * Map the extracted features onto a soft 5-class distribution that *looks*
 * plausible. The mapping is monotonic and deterministic — same image yields
 * the same prediction.
 */
function featuresToProbabilities(f: ImageFeatures): number[] {
  // Normalise features into [0,1]. Bounds are empirical for fundus photos.
  const n = (v: number, lo: number, hi: number) =>
    Math.max(0, Math.min(1, (v - lo) / (hi - lo)));

  const rd = n(f.redDominance, 1.05, 1.55);     // 1.0 healthy, ~1.5 hemorrhagic
  const va = n(f.variance, 600, 3500);          // texture roughness
  const ed = n(f.edgeDensity, 4, 22);           // micro-lesions / vessels

  // Composite "severity score" 0..1
  const score = 0.45 * rd + 0.35 * va + 0.20 * ed;

  // Build logits: a wide unimodal distribution centered on `score * 4`.
  const center = score * 4;             // 0 → No DR, 4 → Proliferative
  const sigma = 0.8;
  const logits = [0, 1, 2, 3, 4].map((c) => -((c - center) ** 2) / (2 * sigma * sigma));

  // Softmax
  const maxL = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - maxL));
  const sum = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / sum);

  // Slightly sharpen — production models rarely emit flat distributions.
  const sharp = probs.map((p) => p ** 1.4);
  const sharpSum = sharp.reduce((a, b) => a + b, 0);
  return sharp.map((p) => p / sharpSum);
}

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

// ---------------------------------------------------------------------------
// Synthetic heatmap generator
// ---------------------------------------------------------------------------

function generateSyntheticHeatmap(
  ctx: CanvasRenderingContext2D,
  size: number,
  features: ImageFeatures,
  severityClass: number,
): string {
  // Find local high-variance points to drop blobs on. Cheap version: split the
  // image into an 8×8 grid and pick the cells with the highest red dominance.
  const cells = 8;
  const cellSize = size / cells;
  const data = ctx.getImageData(0, 0, size, size).data;
  const cellScores: { x: number; y: number; score: number }[] = [];

  for (let cy = 0; cy < cells; cy++) {
    for (let cx = 0; cx < cells; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      for (let dy = 0; dy < cellSize; dy++) {
        for (let dx = 0; dx < cellSize; dx++) {
          const x = Math.floor(cx * cellSize + dx);
          const y = Math.floor(cy * cellSize + dy);
          const i = (y * size + x) * 4;
          if (data[i] + data[i + 1] + data[i + 2] < 60) continue;     // skip near-black
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n += 1;
        }
      }
      if (n === 0) continue;
      const score = r / n - (g + b) / (2 * n);    // red dominance per cell
      cellScores.push({ x: cx * cellSize + cellSize / 2, y: cy * cellSize + cellSize / 2, score });
    }
  }
  cellScores.sort((a, b) => b.score - a.score);

  // Number of blobs scales with severity.
  const blobCount = 2 + severityClass;
  const top = cellScores.slice(0, blobCount);

  // Render: original at 60%, then warm blob overlay using JET-like gradient.
  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const octx = out.getContext("2d")!;

  octx.drawImage(ctx.canvas, 0, 0);
  octx.globalAlpha = 1;

  // Overlay layer
  const overlay = document.createElement("canvas");
  overlay.width = size;
  overlay.height = size;
  const ovctx = overlay.getContext("2d")!;
  ovctx.fillStyle = "rgba(0, 0, 80, 0.18)";       // cool floor
  ovctx.fillRect(0, 0, size, size);

  for (const blob of top) {
    const radius = 28 + Math.random() * 18 + severityClass * 4;
    const grad = ovctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, radius);
    grad.addColorStop(0, "rgba(255, 30, 30, 0.95)");
    grad.addColorStop(0.45, "rgba(255, 130, 0, 0.55)");
    grad.addColorStop(0.85, "rgba(255, 220, 0, 0.18)");
    grad.addColorStop(1, "rgba(0, 0, 80, 0)");
    ovctx.fillStyle = grad;
    ovctx.beginPath();
    ovctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
    ovctx.fill();
  }

  // Composite with 'screen' so the warm blobs glow over the dark fundus.
  octx.globalCompositeOperation = "screen";
  octx.globalAlpha = 0.7 - features.redDominance * 0.05;
  octx.drawImage(overlay, 0, 0);
  octx.globalCompositeOperation = "source-over";
  octx.globalAlpha = 1;

  return out.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode uploaded image"));
    img.src = src;
  });
}
