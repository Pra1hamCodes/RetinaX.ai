import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { historyApi } from "@/api/endpoints";
import FilterBar, { type HistoryFilters } from "@/components/dashboard/FilterBar";
import HistoryTable from "@/components/dashboard/HistoryTable";
import PredictionModal from "@/components/dashboard/PredictionModal";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import PageWrapper from "@/components/layout/PageWrapper";
import Button from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import type { HistoryPage, PredictionRecord } from "@/types";

const PER_PAGE = 10;

const EMPTY_FILTERS: HistoryFilters = { severity: null, dateFrom: "", dateTo: "" };

export default function DashboardPage() {
  const { user, hydrated, isDemo } = useAuthStore();
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS);
  const [data, setData] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<PredictionRecord | null>(null);

  useEffect(() => {
    if (!user) return;
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    historyApi
      .list({
        page,
        per_page: PER_PAGE,
        severity: filters.severity ?? undefined,
        date_from: filters.dateFrom || undefined,
        date_to: filters.dateTo || undefined,
      })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message ?? "Failed to load history"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user, isDemo, page, filters]);

  if (!hydrated) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: "/dashboard" }} />;

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  const onDelete = async (row: PredictionRecord) => {
    if (!confirm(`Delete this analysis from ${row.created_at}?`)) return;
    try {
      await historyApi.remove(row.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((r) => r.id !== row.id),
              total: prev.total - 1,
            }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
              History
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
              Your Analysis History
            </h1>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              {data ? `${data.total} prediction${data.total === 1 ? "" : "s"} on file.` : "—"}
            </p>
          </div>
          <span className="rounded-full border border-[#1F1F1F] bg-[#0F0F0F] px-4 py-1 text-xs uppercase tracking-widest">
            {data?.total ?? 0} total
          </span>
        </header>

        {isDemo && !user && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#fcd34d]/40 bg-[#231b08] px-4 py-3 text-sm text-[#fcd34d]">
            <span className="material-symbols-outlined" aria-hidden>
              cloud_off
            </span>
            <div className="flex-1">
              <strong className="font-semibold">Demo session</strong>
              <span className="ml-2 text-[var(--color-muted)]">
                Backend offline — analysis history is per-device only and isn't persisted.
                Boot the backend and sign in again to see your saved scans.
              </span>
            </div>
          </div>
        )}

        <FilterBar
          filters={filters}
          onChange={(next) => {
            setPage(1);
            setFilters(next);
          }}
          onReset={() => {
            setPage(1);
            setFilters(EMPTY_FILTERS);
          }}
        />

        <div className="mt-6">
          <ErrorBoundary>
            {error && (
              <div className="mb-4 rounded border border-[var(--color-primary)] bg-[#1a0a0a] px-3 py-2 text-sm text-[var(--color-primary)]">
                {error}
              </div>
            )}
            {loading ? (
              <div className="rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-12 text-center text-[var(--color-muted)]">
                Loading…
              </div>
            ) : (
              data && <HistoryTable rows={data.items} onView={setActive} onDelete={onDelete} />
            )}
          </ErrorBoundary>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm text-[var(--color-muted)]">
          <span>
            Page {page} / {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {active && <PredictionModal record={active} onClose={() => setActive(null)} />}
    </PageWrapper>
  );
}
