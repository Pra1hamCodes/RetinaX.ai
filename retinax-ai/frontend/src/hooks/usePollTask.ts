import { useEffect, useRef } from "react";

import { predictApi } from "@/api/endpoints";
import { usePredictionStore } from "@/store/predictionStore";

const POLL_MS = 1500;
const MAX_ATTEMPTS = 80;             // ~2 minutes ceiling

export function usePollTask() {
  const { taskId, stage, setStage, setResult, setError } = usePredictionStore();
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!taskId || stage !== "analyzing") return;
    attemptsRef.current = 0;
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      if (cancelled) return;
      attemptsRef.current += 1;
      try {
        const status = await predictApi.status(taskId);
        if (cancelled) return;

        if (status.status === "complete") {
          setResult(status.result);
          setStage("complete");
          return;
        }
        if (status.status === "failed") {
          setError(status.error);
          setStage("error");
          return;
        }
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          setError("Inference timed out. Please retry.");
          setStage("error");
          return;
        }
        timer = window.setTimeout(tick, POLL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Network error");
        setStage("error");
      }
    };

    timer = window.setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [taskId, stage, setResult, setStage, setError]);
}
