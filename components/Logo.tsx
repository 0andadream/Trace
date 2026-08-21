type LogoProps = {
  className?: string;
  title?: string;
};

export function Logo({ className = "h-8 w-8", title = "Trace" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      <rect width="128" height="128" rx="18" fill="#111318" />
      <path d="M40 24 V104" stroke="#6ee7d2" strokeWidth="6" strokeLinecap="round" />
      <circle cx="40" cy="36" r="8" fill="#6ee7d2" />
      <circle cx="40" cy="64" r="8" fill="#ece8dc" />
      <circle cx="40" cy="92" r="8" fill="#6ee7d2" />
      <path d="M52 36 H96" stroke="#6ee7d2" strokeWidth="5" strokeLinecap="round" />
      <path d="M52 64 H84" stroke="#ece8dc" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      <path d="M52 92 H72" stroke="#6ee7d2" strokeWidth="5" strokeLinecap="round" opacity="0.55" />
    </svg>
  );
}
