import type {
  AllTrainingMetrics,
  DatasetStats,
  HistoryPage,
  PredictionRecord,
  TaskAccepted,
  TaskStatus,
  UserOut,
} from "@/types";

import { ApiError } from "./client";
import { api } from "./client";
import { isDemoTask, pollDemoTask, startDemoInference } from "./demoInference";

function isOfflineError(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 0 || err.status >= 502;
  }
  return true;
}

export interface AuthResponse {
  user: UserOut;
}

export const authApi = {
  signup: (data: { email: string; password: string; display_name: string }) =>
    api.post<AuthResponse>("/auth/signup", data).then((r) => r.data),
  login: (data: { email: string; password: string }) =>
    api.post<AuthResponse>("/auth/login", data).then((r) => r.data),
  logout: () => api.post("/auth/logout"),
  me: () => api.get<UserOut>("/auth/me").then((r) => r.data),
};

export const predictApi = {
  submit: async (file: File): Promise<TaskAccepted> => {
    const fd = new FormData();
    fd.append("image", file);
    try {
      const res = await api.post<TaskAccepted>("/predict", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    } catch (err) {
      if (isOfflineError(err)) {
        return startDemoInference(file);
      }
      throw err;
    }
  },
  status: async (taskId: string): Promise<TaskStatus> => {
    if (isDemoTask(taskId)) return pollDemoTask(taskId);
    try {
      const res = await api.get<TaskStatus>(`/predict/${taskId}`);
      return res.data;
    } catch (err) {
      if (isOfflineError(err)) {
        // The originating submit went through the real API but the backend
        // disappeared mid-request. Surface a clean failure rather than spinning.
        return { status: "failed", error: "Backend went offline mid-request" };
      }
      throw err;
    }
  },
};

export interface HistoryQuery {
  page?: number;
  per_page?: number;
  severity?: number;
  date_from?: string;
  date_to?: string;
}

export const historyApi = {
  list: (q: HistoryQuery = {}) =>
    api.get<HistoryPage>("/history", { params: q }).then((r) => r.data),
  get: (id: string) =>
    api.get<PredictionRecord>(`/history/${id}`).then((r) => r.data),
  remove: (id: string) => api.delete(`/history/${id}`),
};

// ---------------------------------------------------------------------------
// Metrics endpoints — fall back to bundled static JSON when the backend isn't
// reachable. The static-metrics.json carries `_demo: true` so the page can
// flag it visibly to the user; the static-dataset.json carries real on-disk
// counts (`_demo: false`).
// ---------------------------------------------------------------------------

async function fetchStatic<T>(path: string): Promise<T> {
  const r = await fetch(path, { cache: "no-store" });
  if (!r.ok) throw new Error(`Static fallback ${path} failed: ${r.status}`);
  return r.json() as Promise<T>;
}

export type MetricsSource = "live" | "demo" | "real-static";

export interface DatasetStatsWithSource extends DatasetStats {
  _source: MetricsSource;
}
export interface AllTrainingMetricsWithSource extends AllTrainingMetrics {
  _source: MetricsSource;
}

export const metricsApi = {
  training: async (): Promise<AllTrainingMetricsWithSource> => {
    try {
      const live = await api.get<AllTrainingMetrics>("/metrics/training").then((r) => r.data);
      return { ...live, _source: "live" };
    } catch {
      const fb = await fetchStatic<AllTrainingMetrics & { _demo?: boolean }>(
        "/static-metrics.json",
      );
      return { ...fb, _source: fb._demo ? "demo" : "real-static" };
    }
  },
  dataset: async (): Promise<DatasetStatsWithSource> => {
    try {
      const live = await api.get<DatasetStats>("/metrics/dataset").then((r) => r.data);
      return { ...live, _source: "live" };
    } catch {
      const fb = await fetchStatic<DatasetStats & { _demo?: boolean }>("/static-dataset.json");
      return { ...fb, _source: fb._demo ? "demo" : "real-static" };
    }
  },
};
