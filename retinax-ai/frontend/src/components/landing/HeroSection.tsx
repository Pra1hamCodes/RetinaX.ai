import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const user = useAuthStore((s) => s.user);

  // Tracked for downstream consumers (kept so future scroll-driven flourishes
  // have a single source of truth). Currently unused after the eye-removal.
  useEffect(() => {
    const onScroll = () => {
      /* placeholder — animation hook retained for future use */
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden text-center"
    >
      {/* Background video — full-bleed */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        poster="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>"
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* Red wash — 35% opacity (i.e. ~65% transparent), so the video remains legible */}
      <div
        className="absolute inset-0 mix-blend-multiply"
        style={{ background: "rgba(220, 38, 38, 0.35)" }}
        aria-hidden
      />

      {/* Vignette to anchor the headline against the busy footage */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(0,0,0,0) 25%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.9) 100%)",
        }}
        aria-hidden
      />

      {/* Animated scan line — keeps the medical-imaging vibe */}
      <div className="scan-line" aria-hidden />

      {/* Centered content */}
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 py-24">
        <div className="font-mono text-xs uppercase tracking-[0.5em] text-white/85">
          RetinaX AI · Diagnostic Suite
        </div>

        <h1 className="mt-6 text-6xl font-extrabold leading-[1.02] tracking-tight md:text-8xl">
          See What
          <br />
          Others <span style={{ color: "var(--color-primary)" }}>Miss.</span>
        </h1>

        <p className="mt-8 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
          AI-powered diabetic retinopathy detection with explainable results.
          A clinical-grade ensemble — binary CNN, multiclass CNN, and
          EfficientNet — with Grad-CAM attention overlays.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={user ? "/detect" : "/login"}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-7 py-3.5 text-base font-semibold transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              biotech
            </span>
            {user ? "Analyze Your Retina" : "Login to Analyze"}
          </Link>
          <Link
            to="/approach"
            className="inline-flex items-center gap-2 rounded-md border border-white/30 bg-black/30 px-7 py-3.5 text-base font-semibold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-black/50"
          >
            How it works
          </Link>
        </div>

        <ul className="mt-14 grid w-full max-w-2xl grid-cols-3 gap-4 text-xs uppercase tracking-widest text-white/70">
          <li className="rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
            <span className="block tabular text-2xl font-bold text-white md:text-3xl">5-class</span>
            Severity grading
          </li>
          <li className="rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
            <span className="block tabular text-2xl font-bold text-white md:text-3xl">Grad-CAM</span>
            Explainability
          </li>
          <li className="rounded-lg border border-white/10 bg-black/35 px-4 py-3 backdrop-blur-sm">
            <span className="block tabular text-2xl font-bold text-white md:text-3xl">~2 s</span>
            Inference time
          </li>
        </ul>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.4em] text-white/65">
        Scroll · Discover the system
      </div>
    </section>
  );
}
