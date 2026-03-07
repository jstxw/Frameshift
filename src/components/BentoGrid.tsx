"use client";

import { FeatureCard } from "./FeatureCard";
import { useInView } from "@/hooks/useInView";

const FEATURES = [
  {
    label: "DETECT",
    title: "AI Object Detection",
    description: "Select any object just by clicking on it",
    bg: "#111827",
  },
  {
    label: "REMOVE",
    title: "Background Removal",
    description: "Remove or swap backgrounds instantly",
    bg: "#18181B",
  },
  {
    label: "RECOLOR",
    title: "Color Grading",
    description: "Change the color of any detected object",
    bg: "#1C1917",
  },
  {
    label: "RESIZE",
    title: "Smart Resize",
    description: "Reframe for any platform in one click",
    bg: "#F43F5E",
  },
];

export function BentoGrid() {
  const { ref: headingRef, inView: headingInView } = useInView();
  const { ref: gridRef, inView: gridInView } = useInView();

  return (
    <section>
      <div className="px-6 md:px-12 lg:px-24 pt-24 pb-12">
        {/* Heading */}
        <div ref={headingRef} className="text-center mb-12">
          <h2
            className={`font-extrabold tracking-tight leading-none text-[clamp(2rem,10vw,8rem)] ${
              headingInView ? "animate-logo-intro" : "opacity-0"
            }`}
          >
            Edit{" "}
            <span className="keyword-highlight">
              {"anything".split("").map((letter, i) => (
                <span
                  key={i}
                  className="wave-letter"
                  style={{ animationDelay: `${i * 0.08}s` }}
                >
                  {letter}
                </span>
              ))}
            </span>{" "}
            in frame.
          </h2>
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto"
        >
          {FEATURES.map((feature, i) => (
            <div
              key={feature.label}
              className={`${gridInView ? "animate-fade-up" : "opacity-0"}`}
              style={{
                animationDelay: gridInView ? `${(i + 1) * 0.1}s` : undefined,
              }}
            >
              <FeatureCard {...feature} />
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
