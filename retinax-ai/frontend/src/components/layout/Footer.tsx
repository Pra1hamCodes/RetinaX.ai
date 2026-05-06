import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  { to: "/approach", label: "Our Approach" },
  { to: "/evaluation", label: "Model Evaluation" },
  { to: "/dataset", label: "Dataset" },
] as const;

export default function Footer() {
  return (
    <footer className="border-t border-[#1F1F1F] bg-black px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
          {FOOTER_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="rounded-md border border-[#1F1F1F] bg-[#0F0F0F] px-5 py-3 text-center text-sm font-semibold transition-colors hover:border-[var(--color-primary)] hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-4 text-sm text-[var(--color-muted)] sm:flex-row sm:justify-between">
          <div>
            Built for clinical-grade DR screening · Creator: Prathmesh Pandey
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/Pra1hamCodes"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="rounded-md p-2 transition-colors hover:bg-[#0F0F0F] hover:text-white"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.55v-2.18c-3.2.69-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.25 3.34.96.1-.74.4-1.25.72-1.54-2.55-.29-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.17a10.97 10.97 0 0 1 5.74 0c2.19-1.48 3.15-1.17 3.15-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.04.78 2.1v3.11c0 .3.21.66.8.55C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/in/prathmesh-pandey1103"
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn"
              className="rounded-md p-2 transition-colors hover:bg-[#0F0F0F] hover:text-white"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden>
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.37V9h3.41v1.56h.05c.48-.9 1.65-1.85 3.4-1.85 3.64 0 4.32 2.4 4.32 5.52v6.22zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.02H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
              </svg>
            </a>
            <span className="font-mono text-xs uppercase tracking-wider text-[var(--color-muted)]">
              RetinaX AI © {new Date().getFullYear()}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
