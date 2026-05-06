import ErrorBoundary from "@/components/layout/ErrorBoundary";
import PageWrapper from "@/components/layout/PageWrapper";
import ResultPanel from "@/components/detection/ResultPanel";
import UploadZone from "@/components/detection/UploadZone";
import { usePollTask } from "@/hooks/usePollTask";
import { useAuthStore } from "@/store/authStore";
import { Navigate } from "react-router-dom";

export default function DetectionPage() {
  usePollTask();
  const { user, hydrated } = useAuthStore();

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: "/detect" }} />;

  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-10">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
            Diagnostic Suite · v1.0
          </div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Retinal Analysis
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">
            Drop a fundus image to receive an explainable diabetic-retinopathy
            grade across five severity classes, complete with a Grad-CAM
            attention map and a clinical recommendation.
          </p>
        </header>

        <ErrorBoundary>
          <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
            <UploadZone />
            <div className="rounded-xl border border-[#1F1F1F] bg-black p-6">
              <ResultPanel />
            </div>
          </div>
        </ErrorBoundary>
      </div>
    </PageWrapper>
  );
}
