import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import PageWrapper from "@/components/layout/PageWrapper";

gsap.registerPlugin(ScrollTrigger);

const PIPELINE = [
  {
    n: "01",
    title: "Image Preprocessing",
    desc:
      "Crop black borders via threshold + bounding rect, resize to 224×224, apply CLAHE on the L* channel, convert back to RGB. Identical at training and inference.",
    icon: "tune",
  },
  {
    n: "02",
    title: "Binary CNN",
    desc:
      "Sigmoid CNN gates DR vs No-DR. Trained with class-balanced weights — captures the imbalance between healthy and diseased fundi.",
    icon: "rule",
  },
  {
    n: "03",
    title: "Multi-Class CNN",
    desc:
      "5-class softmax CNN trained from scratch. Distinguishes Mild, Moderate, Severe, Proliferative DR with quadratic-weighted Cohen's kappa as the headline metric.",
    icon: "stairs",
  },
  {
    n: "04",
    title: "EfficientNet-B0/B4 Transfer",
    desc:
      "ImageNet-pretrained EfficientNet, fine-tuned on the APTOS dataset. Two-stage training: head only, then unfreeze the last 30% of the backbone.",
    icon: "auto_awesome",
  },
  {
    n: "05",
    title: "Weighted Ensemble",
    desc:
      "Per-class probabilities combined with weights 0.2 binary · 0.3 multiclass · 0.5 EfficientNet. Renormalised when a model is unavailable.",
    icon: "merge_type",
  },
  {
    n: "06",
    title: "Grad-CAM Explainability",
    desc:
      "Class-activation maps from the strongest available branch. Overlays show clinicians where the model focused — drusen-like spots, hemorrhages, neovascular zones.",
    icon: "visibility",
  },
];

export default function ApproachPage() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".step-card", {
        scrollTrigger: { trigger: root.current, start: "top 75%" },
        x: -30,
        opacity: 0,
        duration: 0.7,
        stagger: 0.12,
        ease: "power2.out",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <PageWrapper>
      <div className="mx-auto max-w-5xl px-6">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-[var(--color-primary)]">
          Methodology
        </div>
        <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">
          How RetinaX AI thinks.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-[var(--color-muted)]">
          Six deterministic stages, each auditable in isolation. The same
          preprocessing pipeline runs at training and inference time — there is
          no hidden train/serve skew.
        </p>

        <div ref={root} className="relative mt-14">
          <div
            className="absolute left-[18px] top-0 h-full w-px"
            style={{ background: "linear-gradient(to bottom, var(--color-primary), transparent)" }}
            aria-hidden
          />
          <ol className="flex flex-col gap-6">
            {PIPELINE.map((s) => (
              <li
                key={s.n}
                className="step-card relative rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6 pl-16"
              >
                <div
                  className="absolute left-0 top-6 flex h-9 w-9 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: "var(--color-primary)",
                    background: "#0F0F0F",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: "var(--color-primary)" }}
                    aria-hidden
                  >
                    {s.icon}
                  </span>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-primary)]">
                  Step {s.n}
                </div>
                <h2 className="mt-1 text-xl font-bold">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
                  {s.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-14 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
          <h3 className="text-lg font-semibold">Why explainability matters</h3>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            A black-box DR classifier may be accurate, but a clinician cannot
            sign off on a score they cannot justify. Grad-CAM overlays reveal
            the lesions the network keyed on — making the model's verdict
            verifiable, falsifiable, and clinically useful.
          </p>
        </div>
      </div>
    </PageWrapper>
  );
}
