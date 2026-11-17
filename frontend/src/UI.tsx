import type { ReactNode } from "react";

export function Icon({
  name,
  size = 18,
}: {
  name:
    | "companies"
    | "arrow"
    | "users"
    | "branch"
    | "check"
    | "search"
    | "logout"
    | "clock"
    | "location"
    | "service"
    | "access"
    | "pause"
    | "message"
    | "file"
    | "info"
    | "shield";
  size?: number;
}) {
  const paths = {
    message: <path d="M4 4h16v13H9l-5 4V4Z" />,
    file: (
      <>
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v5h4M9 12h6M9 16h6" />
      </>
    ),
    location: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    service: (
      <>
        <rect x="4" y="7" width="16" height="14" rx="2" />
        <path d="M8 7V4h8v3M4 12h16M10 12v3h4v-3" />
      </>
    ),
    access: (
      <>
        <circle cx="8" cy="9" r="4" />
        <path d="m11 12 8 8 2-2-2-2 2-2-3-3-2 2" />
      </>
    ),
    pause: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8v8M15 8v8" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7h.01" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    companies: (
      <>
        <path d="M3 21V5l9-2v18M12 9h9v12M1 21h22M6 8h3M6 12h3M6 16h3M15 13h3M15 17h3" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" />
      </>
    ),
    branch: (
      <>
        <path d="M6 3v12a5 5 0 0 0 5 5h7M6 8h12" />
        <circle cx="6" cy="3" r="2" />
        <circle cx="19" cy="8" r="2" />
        <circle cx="19" cy="20" r="2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    search: (
      <>
        <circle cx="10" cy="10" r="6" />
        <path d="m15 15 5 5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5m5-12 4 4-4 4m-6-4h10" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
export function Brand({ wordmark = false }: { wordmark?: boolean }) {
  if (wordmark)
    return (
      <div className="brand brand-wordmark">
        Qualify<span className="wordmark-flow">Flow</span>
        <span className="brand-dot" aria-hidden="true">
          .
        </span>
      </div>
    );
  return (
    <div className="brand">
      <svg
        className="brand-mark"
        width="28"
        height="28"
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <rect width="28" height="28" rx="7" fill="currentColor" />
        <path
          d="M8 19 19 8M10 8h9v9"
          fill="none"
          stroke="white"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      QualifyFlow<span className="brand-dot">.</span>
    </div>
  );
}
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-art" aria-hidden="true">
        <Brand />
        <div className="art-content">
          <p className="eyebrow">EVIDENCE IN MOTION</p>
          <h2>
            A clear path.
            <br />
            An accountable record.
          </h2>
          <svg className="evidence-art" viewBox="0 0 460 310" fill="none">
            <path
              className="art-grid"
              d="M0 55h460M0 115h460M0 175h460M0 235h460M50 0v310M110 0v310M170 0v310M230 0v310M290 0v310M350 0v310M410 0v310"
            />
            <path
              className="art-track"
              d="M75 94h66a32 32 0 0 1 32 32v24h102v-24a32 32 0 0 1 32-32h78M75 214h66a32 32 0 0 0 32-32v-32m102 0v32a32 32 0 0 0 32 32h78"
            />
            <g className="art-node">
              <rect x="25" y="65" width="90" height="60" rx="9" fill="white" />
              <path
                d="M43 83h31M43 93h49M43 103h36"
                stroke="#8293B7"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect x="25" y="185" width="90" height="60" rx="9" fill="white" />
              <path
                d="M43 203h31M43 213h49M43 223h36"
                stroke="#8293B7"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <rect
                x="190"
                y="115"
                width="70"
                height="70"
                rx="17"
                fill="#265CFF"
              />
              <path
                d="m208 151 12 11 23-25"
                stroke="white"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <rect
                x="335"
                y="65"
                width="90"
                height="180"
                rx="9"
                fill="white"
              />
              <path
                d="M352 88h29M352 104h55M352 154h55M352 204h55"
                stroke="#CED8EB"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="357" cy="130" r="5" fill="#265CFF" />
              <circle cx="357" cy="180" r="5" fill="#265CFF" />
              <circle cx="357" cy="230" r="5" fill="#265CFF" />
            </g>
          </svg>
          <div className="art-caption">
            <span>Source</span>
            <span>Review</span>
            <span>Record</span>
          </div>
        </div>
        <p className="art-footer">
          One workspace. Every important step connected.
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand">
          <Brand />
        </div>
        <div className="auth-form">{children}</div>
        <div className="auth-environment">
          <span className="environment-dot" />
          Local workspace <span>·</span> Synthetic data only
        </div>
      </section>
    </main>
  );
}
