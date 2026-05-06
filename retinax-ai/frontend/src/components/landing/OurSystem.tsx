import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

const STAGES = [
  {
    icon: "rule",
    title: "Binary Classifier",
    desc: "Sigmoid CNN gates DR vs No-DR. Catches disease in a single call.",
    metric: "Stage 1",
  },
  {
    icon: "stairs",
    title: "Multi-class CNN",
    desc: "5-class softmax CNN trained from scratch. Distinguishes severity 0–4.",
    metric: "Stage 2",
  },
  {
    icon: "auto_awesome",
    title: "EfficientNet Ensemble",
    desc: "ImageNet transfer + weighted ensemble. Final verdict + Grad-CAM.",
    metric: "Stage 3",
  },
];

export default function OurSystem() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".sys-card", {
        scrollTrigger: { trigger: root.current, start: "top 75%" },
        y: 30,
        opacity: 0,
        duration: 0.8,
        stagger: 0.18,
        ease: "power2.out",
      });
      gsap.fromTo(
        ".sys-line",
        { scaleX: 0, transformOrigin: "left" },
        {
          scrollTrigger: { trigger: root.current, start: "top 65%" },
          scaleX: 1,
          duration: 1.1,
          ease: "power2.out",
          stagger: 0.2,
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-t border-[#1F1F1F] bg-black px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-[var(--color-primary)]">
          02 · The System
        </div>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
          A three-stage, explainable ensemble.
        </h2>
        <p className="mt-4 max-w-2xl text-sm text-[var(--color-muted)]">
          Each stage is auditable and replaceable. Models load once at worker
          startup; preprocessing is identical between training and inference.
        </p>

        <div className="relative mt-14 grid gap-8 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="sys-card rounded-2xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-primary)]">
                  {s.metric}
                </div>
                <span
                  className="material-symbols-outlined mt-4 text-[36px]"
                  style={{ color: "var(--color-primary)" }}
                  aria-hidden
                >
                  {s.icon}
                </span>
                <h3 className="mt-3 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm text-[var(--color-muted)]">{s.desc}</p>
              </div>

              {i < STAGES.length - 1 && (
                <div
                  className="sys-line absolute right-[-30px] top-1/2 hidden h-px w-[60px] -translate-y-1/2 bg-gradient-to-r from-[var(--color-primary)] to-transparent md:block"
                  aria-hidden
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
