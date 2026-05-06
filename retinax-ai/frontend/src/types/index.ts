export interface UserOut {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ProbabilityMap {
  no_dr: number;
  mild: number;
  moderate: number;
  severe: number;
  proliferative: number;
}

export interface PredictionResult {
  severity_class: 0 | 1 | 2 | 3 | 4;
  severity_label: string;
  confidence: number;
  confidence_binary: number;
  probabilities: ProbabilityMap;
  original_image_url: string;
  heatmap_url: string | null;
  recommendation: string;
  model_version: string;
}

export interface PredictionRecord {
  id: string;
  user_id: string | null;
  original_image_url: string;
  heatmap_url: string | null;
  severity_class: number;
  severity_label: string;
  confidence_binary: number;
  probabilities: ProbabilityMap;
  model_version: string;
  created_at: string;
}

export interface HistoryPage {
  items: PredictionRecord[];
  page: number;
  per_page: number;
  total: number;
}

export interface TaskAccepted {
  task_id: string;
}

export type TaskStatus =
  | { status: "pending" }
  | { status: "complete"; result: PredictionResult }
  | { status: "failed"; error: string };

export const SEVERITY_LABELS = [
  "No DR",
  "Mild",
  "Moderate",
  "Severe",
  "Proliferative DR",
] as const;

export const SEVERITY_COLORS: Record<number, string> = {
  0: "var(--color-sev-0)",
  1: "var(--color-sev-1)",
  2: "var(--color-sev-2)",
  3: "var(--color-sev-3)",
  4: "var(--color-sev-4)",
};

export interface TrainingMetrics {
  accuracy: number;
  precision_weighted: number;
  recall_weighted: number;
  f1_weighted: number;
  kappa: number;
  confusion_matrix: number[][];
  history?: Record<string, number[] | Record<string, number[]>>;
  classes?: string[];
  roc?: Record<string, { fpr: number[]; tpr: number[]; auc: number }>;
}

export interface AllTrainingMetrics {
  binary: TrainingMetrics | null;
  multiclass: TrainingMetrics | null;
  efficientnet: TrainingMetrics | null;
}

export interface DatasetStats {
  total: number;
  classes: { label: string; count: number; percentage: number }[];
  source: string;
  image_size: number;
  split_ratio: { train: number; val: number; test: number };
}
