import type { ReactNode } from "react";

export function PhoneFrame({
  children,
  className = "",
  float = false,
}: {
  children: ReactNode;
  className?: string;
  float?: boolean;
}) {
  return (
    <div className={`phone-device ${float ? "phone-float" : ""} ${className}`.trim()}>
      <span className="phone-btn phone-btn-silent" aria-hidden />
      <span className="phone-btn phone-btn-vol-up" aria-hidden />
      <span className="phone-btn phone-btn-vol-down" aria-hidden />
      <span className="phone-btn phone-btn-power" aria-hidden />
      <div className="phone-bezel">
        <div className="phone-screen">
          <span className="phone-island" aria-hidden />
          {children}
          <span className="phone-home" aria-hidden />
        </div>
      </div>
    </div>
  );
}
