import type { CSSProperties, ReactElement } from "react";

/**
 * Inline SVG icons (Lucide, ISC-licensed paths) so we ship crisp, therme-aware
 * icons instead of emoji glyphs — no runtime image fetch (fragile for a static
 * site), scalable, and colored via currentColor. Add a path set to extend.
 */
export type IconName =
  | "dice" | "cloud-off" | "monitor" | "server" | "package" | "search"
  | "coffee" | "download" | "swap" | "alert" | "check" | "x";

const PATHS: Record<IconName, ReactElement> = {
  dice: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 8h.01" /><path d="M16 8h.01" /><path d="M12 12h.01" />
      <path d="M8 16h.01" /><path d="M16 16h.01" />
    </>
  ),
  "cloud-off": (
    <>
      <path d="m2 2 20 20" />
      <path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193" />
      <path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07" />
    </>
  ),
  monitor: (
    <>
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8" /><path d="M12 17v4" />
    </>
  ),
  server: (
    <>
      <rect width="20" height="8" x="2" y="2" rx="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6 6h.01" /><path d="M6 18h.01" />
    </>
  ),
  package: (
    <>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
      <path d="M3.3 7 12 12l8.7-5" /><path d="M12 22V12" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </>
  ),
  coffee: (
    <>
      <path d="M10 2v2" /><path d="M14 2v2" /><path d="M6 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" /><path d="M12 15V3" />
    </>
  ),
  swap: (
    <>
      <path d="M8 3 4 7l4 4" /><path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" /><path d="M20 17H4" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" /><path d="M12 17h.01" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />
};

export default function Icon({
  name,
  size = 18,
  className,
  style
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ display: "inline-block", verticalAlign: "-0.18em", flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
