import React from "react";

export function HexagonLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

export function BeeLogo({
  className,
  style,
  alt = "Gigabee",
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src="/gigabee-logo.png"
      alt={alt}
      className={className}
      style={style}
      {...props}
    />
  );
}

export function HoneycombBg({
  id = "hc-bg",
  className = "",
}: {
  id?: string;
  className?: string;
}) {
  /*
   * Pointy-top regular hexagons circumradius R = 32, apothem a = 27.7
   * All 6 edges have length R = 32 (verified: √(27.7²+16²) ≈ 32)
   *
   * Minimal seamless tile: width = 2a = 55.4, height = 3R = 96
   * Two hex centres per tile:
   *   Hex A (0,  32): partial, wraps left/right
   *   Hex B (a,  80): partial, wraps bottom
   */
  const patId  = id;
  const gradId = `${id}-gr`;
  const maskId = `${id}-mk`;

  return (
    <svg
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    >
      <defs>
        {/* Radial vignette mask bright centre, invisible at edges */}
        <radialGradient id={gradId} cx="50%" cy="50%" r="65%">
          <stop offset="0%"   stopColor="white" stopOpacity="1"   />
          <stop offset="55%"  stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0"   />
        </radialGradient>
        <mask id={maskId}>
          <rect width="100%" height="100%" fill={`url(#${gradId})`} />
        </mask>

        {/* Perfect hex grid pattern */}
        <pattern
          id={patId}
          x="0"
          y="0"
          width="55.4"
          height="96"
          patternUnits="userSpaceOnUse"
        >
          {/* Hex A centre (0, 32) clips at left/right, tiles seamlessly */}
          <path
            d="M0,0 L27.7,16 L27.7,48 L0,64 L-27.7,48 L-27.7,16Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
          {/* Hex B centre (27.7, 80) clips at bottom, tiles seamlessly */}
          <path
            d="M27.7,48 L55.4,64 L55.4,96 L27.7,112 L0,96 L0,64Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </pattern>
      </defs>

      <rect
        width="100%"
        height="100%"
        fill={`url(#${patId})`}
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}

type HexSize = "xs" | "sm" | "md" | "lg";
type HexVariant = "primary" | "muted" | "ghost";

const hexSizes: Record<HexSize, string> = {
  xs: "w-6 h-6",
  sm: "w-9 h-9",
  md: "w-11 h-11",
  lg: "w-14 h-14",
};

const hexVariants: Record<HexVariant, string> = {
  primary: "bg-primary/15 text-primary",
  muted:   "bg-secondary/80 text-muted-foreground",
  ghost:   "bg-foreground/5 text-muted-foreground",
};

export function HexBadge({
  children,
  size = "md",
  variant = "muted",
  className = "",
}: {
  children: React.ReactNode;
  size?: HexSize;
  variant?: HexVariant;
  className?: string;
}) {
  return (
    <div
      className={`
        ${hexSizes[size]} ${hexVariants[variant]}
        hex-clip flex items-center justify-center shrink-0
        ${className}
      `}
    >
      {children}
    </div>
  );
}
