import { DropZone } from "./DropZone";
import { DemoVideo } from "./DemoVideo";

export function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center px-6 md:px-12 lg:px-24 pt-24 pb-16">
      {/* Heading */}
      <h1 className="animate-fade-up stagger-1 text-center font-[550] tracking-tight leading-none text-[clamp(2rem,10vw,8rem)]">
        Edit your videos
        <br />
        with just an{" "}
        <span className="inline-block font-bold text-[var(--accent)] px-1 py-0.5 rounded-sm">
          idea.
        </span>
      </h1>

      {/* Subtitle */}
      <p className="animate-fade-up stagger-2 mt-6 text-[var(--fg-muted)] text-xl text-center max-w-lg">
        AI-powered editing. No complexity.
      </p>

      {/* Drop Zone */}
      <div className="animate-fade-up stagger-3 mt-10 w-full">
        <DropZone />
      </div>

      {/* Demo Video */}
      <div className="animate-fade-up stagger-4 mt-12 w-full">
        <DemoVideo />
      </div>
    </section>
  );
}
