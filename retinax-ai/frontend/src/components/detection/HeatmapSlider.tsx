import { useCallback, useEffect, useRef, useState } from "react";

import { resolveStorageUrl } from "@/utils";

type Mode = "compare" | "original" | "heatmap";

interface Props {
  originalUrl: string;
  heatmapUrl: string | null;
}

export default function HeatmapSlider({ originalUrl, heatmapUrl }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<Mode>("compare");
  const [pct, setPct] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    setPct((x / rect.width) * 100);
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingRef.current) updateFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [updateFromClientX]);

  const original = resolveStorageUrl(originalUrl);
  const heatmap = heatmapUrl ? resolveStorageUrl(heatmapUrl) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
          Grad-CAM Explainability
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-[#1F1F1F] text-xs">
          {(["original", "compare", "heatmap"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                mode === m
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-[#0F0F0F] text-[var(--color-muted)] hover:text-white"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative aspect-square w-full select-none overflow-hidden rounded-xl border border-[#1F1F1F] bg-black"
        onMouseDown={(e) => {
          if (mode !== "compare") return;
          draggingRef.current = true;
          updateFromClientX(e.clientX);
        }}
        onTouchMove={(e) => {
          if (mode !== "compare") return;
          updateFromClientX(e.touches[0].clientX);
        }}
      >
        {mode !== "heatmap" && (
          <img
            src={original}
            alt="Original retinal scan"
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}
        {heatmap && mode !== "original" && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              clipPath:
                mode === "heatmap" ? "inset(0 0 0 0)" : `inset(0 0 0 ${pct}%)`,
            }}
          >
            <img
              src={heatmap}
              alt="Grad-CAM attention heatmap"
              className="h-full w-full object-contain"
            />
          </div>
        )}

        {mode === "compare" && heatmap && (
          <>
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-[var(--color-primary)]"
              style={{ left: `${pct}%`, boxShadow: "0 0 12px rgba(220, 38, 38, 0.7)" }}
            />
            <div
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize"
              style={{ left: `${pct}%` }}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)] shadow-lg">
                <span className="material-symbols-outlined text-[20px] text-white" aria-hidden>
                  unfold_more
                </span>
              </div>
            </div>
          </>
        )}

        {!heatmap && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-[var(--color-muted)]">
            Heatmap not available for this image.
          </div>
        )}
      </div>

      {mode === "compare" && heatmap && (
        <div className="flex items-center justify-between text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
          <span>Original</span>
          <span>Drag to compare</span>
          <span>Heatmap</span>
        </div>
      )}
    </div>
  );
}
