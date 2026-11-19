export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label="Atlas Wiki 标志"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="2" y="2" width="10.5" height="10.5" rx="1.8" fill="currentColor" opacity="0.92" />
      <rect x="15.5" y="2" width="10.5" height="10.5" rx="1.8" fill="currentColor" opacity="0.6" />
      <rect x="2" y="15.5" width="10.5" height="10.5" rx="1.8" fill="currentColor" opacity="0.38" />
      <rect
        x="15.5"
        y="15.5"
        width="10.5"
        height="10.5"
        rx="1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        opacity="0.9"
      />
    </svg>
  );
}

export function LogoMark({ size = 56 }: { size?: number }) {
  return (
    <div className="inline-flex items-center justify-center rounded-md border border-strong bg-raised p-3">
      <Logo size={size} className="text-primary" />
    </div>
  );
}
