import { TraceArc } from "@/components/TraceArc";

type LogoProps = {
  className?: string;
  title?: string;
  subtitle?: string;
  variant?: "image" | "compact";
  tone?: "dark" | "light";
};

/** Favicon-scale mark: dashed arc on navy, 36px. */
export function TraceMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-[#0A0219] ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <TraceArc className="w-[70%]" />
    </span>
  );
}

export function Logo({
  className = "",
  title = "Trace",
  subtitle,
  variant = "image",
  tone = "dark",
}: LogoProps) {
  if (variant === "compact") {
    const name = tone === "light" ? "text-neutral-900" : "text-white";
    const sub = tone === "light" ? "text-neutral-500" : "text-paper-500";
    return (
      <span className={`inline-flex items-center gap-2.5 ${className}`} aria-label={title}>
        <TraceMark size={36} />
        <span className="flex min-w-0 flex-col items-start">
          <span className={`text-[17px] font-semibold leading-none tracking-[-0.02em] ${name}`}>{title}</span>
          {subtitle ? (
            <span className={`mt-1 hidden text-[13px] font-medium leading-none sm:block ${sub}`}>{subtitle}</span>
          ) : null}
        </span>
      </span>
    );
  }

  return (
    <span className={`block ${className}`} aria-label={title}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt={title} className="block h-auto w-full object-contain" />
    </span>
  );
}
