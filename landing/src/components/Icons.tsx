import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
  style,
}: {
  name:
    | "arrow"
    | "check"
    | "route"
    | "home"
    | "bus"
    | "school"
    | "chevron"
    | "menu"
    | "close"
    | "grid"
    | "people"
    | "wallet"
    | "search"
    | "clock"
    | "shield"
    | "plus";
  size?: number;
  style?: CSSProperties;
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    arrow: (
      <>
        <path d="M5 12h14M13 6l6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    route: (
      <>
        <circle cx="6" cy="6" r="2" />
        <circle cx="18" cy="18" r="2" />
        <path d="M8 6h7a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8" />
      </>
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v10H3Z" />
        <path d="M9 20v-7h6v7" />
      </>
    ),
    bus: (
      <>
        <rect x="4" y="3" width="16" height="16" rx="4" />
        <path d="M4 11h16M8 3v8M7 19v2m10-2v2M8 15h.01M16 15h.01" />
      </>
    ),
    school: (
      <>
        <path d="m3 9 9-6 9 6v12H3ZM9 21v-7h6v7M7 10h.01M17 10h.01M12 7h.01" />
      </>
    ),
    chevron: <path d="m8 10 4 4 4-4" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    people: (
      <>
        <circle cx="9" cy="7" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 5" />
      </>
    ),
    wallet: (
      <>
        <path d="M20 8V5H4v15h16v-5" />
        <path d="M14 9h8v6h-8Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 6 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 6v6l4 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      {paths[name]}
    </svg>
  );
}

export function Brand({
  light = false,
  linked = true,
}: {
  light?: boolean;
  linked?: boolean;
}) {
  const artwork = (
    <img
      className="brand-image"
      src="/brand/furgoplus-logo.png"
      width="1920"
      height="400"
      alt="FurgoPlus · Transporte Escolar"
      decoding="async"
    />
  );
  return linked ? (
    <a
      className={`brand ${light ? "brand-light" : ""}`}
      href="#inicio"
      aria-label="FurgoPlus, volver al inicio"
    >
      {artwork}
    </a>
  ) : (
    <span className={`brand ${light ? "brand-light" : ""}`}>{artwork}</span>
  );
}
