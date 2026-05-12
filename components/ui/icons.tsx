import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...p }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...p}
    >
      {children}
    </svg>
  );
}

export const Icons = {
  Search: (p: P) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  ),
  Filter: (p: P) => (
    <Svg {...p}>
      <path d="M4 5h16M7 12h10M10 19h4" />
    </Svg>
  ),
  Refresh: (p: P) => (
    <Svg {...p}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  ),
  Download: (p: P) => (
    <Svg {...p}>
      <path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
    </Svg>
  ),
  Chevron: (p: P) => (
    <Svg {...p}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  ),
  ChevronR: (p: P) => (
    <Svg {...p}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  ),
  ChevronL: (p: P) => (
    <Svg {...p}>
      <path d="m15 6-6 6 6 6" />
    </Svg>
  ),
  Cal: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Svg>
  ),
  Clock: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  Cache: (p: P) => (
    <Svg {...p}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
    </Svg>
  ),
  Mail: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </Svg>
  ),
  More: (p: P) => (
    <Svg {...p}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  Sort: (p: P) => (
    <Svg {...p}>
      <path d="M7 4v14m0 0 3-3m-3 3-3-3M17 20V6m0 0-3 3m3-3 3 3" />
    </Svg>
  ),
  Bell: (p: P) => (
    <Svg {...p}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </Svg>
  ),
  Members: (p: P) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 19c.5-3.3 3.3-5 6.5-5s6 1.7 6.5 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14c2.5 0 4.5 1.3 5 4" />
    </Svg>
  ),
  Dash: (p: P) => (
    <Svg {...p}>
      <rect x="3" y="3" width="8" height="10" rx="1.5" />
      <rect x="13" y="3" width="8" height="6" rx="1.5" />
      <rect x="3" y="15" width="8" height="6" rx="1.5" />
      <rect x="13" y="11" width="8" height="10" rx="1.5" />
    </Svg>
  ),
  Revenue: (p: P) => (
    <Svg {...p}>
      <path d="M3 17V7m4 10V5m4 12v-8m4 8v-4m4 4V9" />
    </Svg>
  ),
  Segments: (p: P) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="5" />
      <circle cx="16" cy="16" r="5" />
    </Svg>
  ),
  Settings: (p: P) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1A2 2 0 1 1 6.9 4.2l.1.1a1.7 1.7 0 0 0 1.9.4H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </Svg>
  ),
  Signout: (p: P) => (
    <Svg {...p}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </Svg>
  ),
};

export type IconKey = keyof typeof Icons;
