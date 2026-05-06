import { Link } from "react-router-dom";

import PageWrapper from "@/components/layout/PageWrapper";

export default function NotFoundPage() {
  return (
    <PageWrapper>
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
          Error · 404
        </div>
        <h1 className="mt-3 text-5xl font-extrabold tracking-tight">Not found</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">
          The page you were looking for has moved or never existed.
        </p>
        <Link
          to="/"
          className="mt-6 rounded bg-[var(--color-primary)] px-5 py-2 text-sm font-semibold hover:bg-[var(--color-primary-hover)]"
        >
          Back to home
        </Link>
      </div>
    </PageWrapper>
  );
}
