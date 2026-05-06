import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef } from "react";

import { SEVERITY_COLORS, SEVERITY_LABELS } from "@/types";

gsap.registerPlugin(ScrollTrigger);

export default function WhatIsDR() {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.from(".dr-stat", {
        scrollTrigger: { trigger: root.current, start: "top 75%" },
        y: 24,
        opacity: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: "power2.out",
      });
      gsap.from(".dr-bar > span", {
        scrollTrigger: { trigger: ".dr-bar", start: "top 80%" },
        scaleX: 0,
        transformOrigin: "left",
        duration: 0.9,
        stagger: 0.1,
        ease: "power2.out",
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={root} className="border-t border-[#1F1F1F] bg-black px-6 py-24">
      <div className="mx-auto grid max-w-7xl items-start gap-12 lg:grid-cols-2">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.4em] text-[var(--color-primary)]">
            01 · The Disease
          </div>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            What is Diabetic Retinopathy?
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[var(--color-muted)]">
            Diabetic retinopathy is the leading cause of preventable blindness
            in adults. Chronic hyperglycemia damages the retinal microvasculature,
            producing microaneurysms, hemorrhages, exudates, and ultimately
            neovascularization. Detection at early severities — when the eye is
            asymptomatic — preserves vision.
          </p>

          <div className="dr-bar mt-8">
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Severity scale
            </div>
            <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full">
              {SEVERITY_LABELS.map((label, i) => (
                <span
                  key={label}
                  className="block h-full flex-1"
                  style={{ background: SEVERITY_COLORS[i] }}
                  title={label}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-5 text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
              {SEVERITY_LABELS.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="dr-stat rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Diabetics worldwide
            </div>
            <div className="tabular mt-3 text-5xl font-extrabold">537M</div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              and growing — IDF Diabetes Atlas, 10th edition
            </div>
          </div>
          <div className="dr-stat rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Will develop DR
            </div>
            <div className="tabular mt-3 text-5xl font-extrabold">
              1<span className="text-[var(--color-muted)]"> in </span>3
            </div>
            <div className="mt-2 text-sm text-[var(--color-muted)]">
              of all diabetic patients across their lifetime
            </div>
          </div>
          <div className="dr-stat col-span-2 rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6">
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Why screening matters
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted)]">
              Most patients with mild and moderate DR have no symptoms. Annual
              fundus screening — automated where possible — catches disease at a
              treatable stage. RetinaX AI brings that screening directly to the
              point of care.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
