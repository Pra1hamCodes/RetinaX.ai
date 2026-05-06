import { create } from "zustand";

import type { PredictionResult } from "@/types";

export type PredictionStage = "idle" | "uploading" | "analyzing" | "complete" | "error";

interface PredictionState {
  stage: PredictionStage;
  taskId: string | null;
  result: PredictionResult | null;
  previewUrl: string | null;
  error: string | null;
  setPreview: (url: string | null) => void;
  setStage: (s: PredictionStage) => void;
  setTaskId: (id: string | null) => void;
  setResult: (r: PredictionResult | null) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const usePredictionStore = create<PredictionState>((set, get) => ({
  stage: "idle",
  taskId: null,
  result: null,
  previewUrl: null,
  error: null,

  setPreview: (url) => set({ previewUrl: url }),
  setStage: (stage) => set({ stage }),
  setTaskId: (taskId) => set({ taskId }),
  setResult: (result) => set({ result }),
  setError: (error) => set({ error }),

  reset: () => {
    const url = get().previewUrl;
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
    set({ stage: "idle", taskId: null, result: null, previewUrl: null, error: null });
  },
}));
