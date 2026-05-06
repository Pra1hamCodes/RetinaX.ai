import { SEVERITY_COLORS } from "@/types";

/** Combine class names, dropping falsy entries. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Resolve a backend storage URL like "/storage/heatmaps/abc.png" to an absolute URL. */
export function resolveStorageUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  // Storage URLs are served from the same host as the API (different prefix).
  // Storage URLs are served from the same host as the API.
  // Remove leading slash if present and prepend origin + /
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  const origin = window.location.origin;
  return `${origin}${cleanPath}`;
}

export function severityColor(c: number): string {
  return SEVERITY_COLORS[c] ?? "var(--color-muted)";
}

export function formatPercent(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatRelativeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function bytesToMB(bytes: number, digits = 2): string {
  return `${(bytes / 1024 / 1024).toFixed(digits)} MB`;
}
