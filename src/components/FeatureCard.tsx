interface FeatureCardProps {
  label: string;
  title: string;
  description: string;
  bg: string;
}

export function FeatureCard({
  label,
  title,
  description,
  bg,
}: FeatureCardProps) {
  const isAccent = bg === "#F43F5E";

  return (
    <div
      className="rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent)] border border-transparent"
      style={{ backgroundColor: bg }}
    >
      {/* Label */}
      <span
        className={`text-sm font-semibold uppercase tracking-widest ${
          isAccent ? "text-white/70" : "text-[var(--accent)]"
        }`}
      >
        {label}
      </span>

      {/* Demo Placeholder */}
      <div
        className={`mt-4 aspect-video rounded-xl border border-dashed ${
          isAccent
            ? "bg-white/10 border-white/20"
            : "bg-[var(--surface-darker)] border-[var(--border-dark)]"
        }`}
      />

      {/* Title */}
      <h3
        className={`mt-4 text-2xl font-[550] ${
          isAccent ? "text-white" : "text-white"
        }`}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className={`mt-2 text-base ${
          isAccent ? "text-white/70" : "text-[var(--fg-subtle)]"
        }`}
      >
        {description}
      </p>
    </div>
  );
}
