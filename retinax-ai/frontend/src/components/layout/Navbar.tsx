import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";
import { cx } from "@/utils";

const NAV_LINKS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/approach", label: "Our Approach" },
  { to: "/evaluation", label: "Model Evaluation" },
  { to: "/model-arena", label: "Model Arena" },
  { to: "/dataset", label: "Dataset" },
] as const;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isDemo = useAuthStore((s) => s.isDemo);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const startNowHref = user ? "/detect" : "/login";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-black/70 backdrop-blur-md border-b border-[#1F1F1F]"
          : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span
            className="material-symbols-outlined text-[28px]"
            style={{ color: "var(--color-primary)" }}
            aria-hidden
          >
            visibility
          </span>
          <span className="text-lg">RetinaX AI</span>
        </Link>

        <ul className="hidden items-center gap-8 text-sm md:flex">
          {NAV_LINKS.map((l) => (
            <li key={l.to}>
              <NavLink
                to={l.to}
                className={({ isActive }) =>
                  cx(
                    "transition-colors",
                    isActive ? "text-white" : "text-[var(--color-muted)] hover:text-white",
                  )
                }
              >
                {l.label}
              </NavLink>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            to={startNowHref}
            className="hidden md:inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              bolt
            </span>
            {user ? "Start Now" : "Login to Start"}
          </Link>

          {user ? (
            <div className="relative flex items-center gap-2">
              {isDemo && (
                <span className="hidden rounded-full border border-[#fcd34d]/50 bg-[#231b08] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[#fcd34d] md:inline">
                  Demo
                </span>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen((m) => !m)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1F1F1F] bg-[#0F0F0F] text-sm font-semibold uppercase"
                aria-label="Open user menu"
              >
                {user.display_name?.[0] ?? user.email[0]}
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 top-12 w-60 rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] p-2 text-sm shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div className="px-3 py-2">
                    <div className="truncate font-semibold">{user.display_name}</div>
                    <div className="truncate text-xs text-[var(--color-muted)]">{user.email}</div>
                    {isDemo && (
                      <div className="mt-2 rounded border border-[#fcd34d]/40 bg-[#231b08] px-2 py-1 text-[10px] uppercase tracking-widest text-[#fcd34d]">
                        Local-only · backend offline
                      </div>
                    )}
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="block rounded px-3 py-2 hover:bg-[#161616]"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="block w-full rounded px-3 py-2 text-left text-[var(--color-primary)] hover:bg-[#161616]"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden text-sm text-[var(--color-muted)] hover:text-white md:inline"
            >
              Login
            </Link>
          )}

          <button
            type="button"
            className="md:hidden"
            onClick={() => setMobileOpen((m) => !m)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-[28px]" aria-hidden>
              {mobileOpen ? "close" : "menu"}
            </span>
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="border-t border-[#1F1F1F] bg-black/95 px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-3 text-sm">
            {NAV_LINKS.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-3 py-2 hover:bg-[#0F0F0F]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to={startNowHref}
                onClick={() => setMobileOpen(false)}
                className="block rounded bg-[var(--color-primary)] px-3 py-2 text-center font-semibold"
              >
                {user ? "Start Now" : "Login to Start"}
              </Link>
            </li>
            {!user && (
              <li>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block rounded px-3 py-2 text-center"
                >
                  Login
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
