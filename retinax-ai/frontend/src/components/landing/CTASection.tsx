import { Link } from "react-router-dom";

import { useAuthStore } from "@/store/authStore";

export default function CTASection() {
  const user = useAuthStore((s) => s.user);

  return (
    <section
      className="relative overflow-hidden border-t border-[#1F1F1F] px-6 py-20"
      style={{ background: "var(--color-primary-hover)" }}
    >
      <div className="scan-line" aria-hidden />
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-white/70">
          {user ? "Free analysis · Session active" : "Sign in required for analysis"}
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          {user ? "Start your free retinal analysis." : "Sign in to start your analysis."}
        </h2>
        <p className="max-w-xl text-sm text-white/85">
          {user
            ? "Drop a fundus image and receive an explainable severity grade in seconds."
            : "Create an account or sign in to unlock image analysis, Grad-CAM, and saved history."}
        </p>
        <Link
          to={user ? "/detect" : "/login"}
          className="mt-3 inline-flex items-center gap-2 rounded-md bg-black px-6 py-3 font-semibold text-white transition-colors hover:bg-[#0F0F0F]"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            arrow_forward
          </span>
          {user ? "Open the Diagnostic Suite" : "Login to Continue"}
        </Link>
      </div>
    </section>
  );
}
