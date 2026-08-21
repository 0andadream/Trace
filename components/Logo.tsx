import Image from "next/image";
import { TraceArc } from "@/components/TraceArc";

type LogoProps = {
  className?: string;
  title?: string;
  variant?: "image" | "compact";
};

export function Logo({ className = "", title = "Trace", variant = "image" }: LogoProps) {
  if (variant === "compact") {
    return (
      <span className={`inline-flex flex-col items-start ${className}`} aria-label={title}>
        <span className="text-[22px] font-medium leading-none tracking-tight text-white">Trace</span>
        <TraceArc className="mt-1.5 w-[4.7rem]" />
      </span>
    );
  }

  return (
    <Image
      src="/wordmark.jpg"
      alt={title}
      width={564}
      height={345}
      className={className}
      priority
    />
  );
}
