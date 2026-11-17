import type { ReactNode } from "react";

export type SpotKind =
  "locations" | "invitations" | "specialists" | "search" | "drivers";

/** Original shared geometry: a record frame, one contextual symbol and cobalt detail. */
export function SpotIllustration({ kind }: { kind: SpotKind }) {
  return (
    <svg
      className="spot-illustration"
      viewBox="0 0 112 80"
      width="112"
      height="80"
      fill="none"
      aria-hidden="true"
    >
      <ellipse cx="55" cy="70" rx="43" ry="5" className="spot-ground" />
      <path
        d="M25 18h52a5 5 0 0 1 5 5v38H20V23a5 5 0 0 1 5-5Z"
        className="spot-paper"
      />
      <path d="M29 28h20M29 34h12" className="spot-detail" />
      {kind === "invitations" ? (
        <>
          <rect
            x="40"
            y="37"
            width="47"
            height="29"
            rx="4"
            className="spot-paper"
          />
          <path d="m42 40 21 15 22-15" className="spot-accent" />
        </>
      ) : kind === "specialists" ? (
        <>
          <circle cx="61" cy="39" r="9" className="spot-paper" />
          <path d="M43 66v-5a18 18 0 0 1 36 0v5" className="spot-paper" />
          <path d="M87 27v12M81 33h12" className="spot-accent" />
        </>
      ) : kind === "drivers" ? (
        <>
          <circle cx="65" cy="48" r="20" className="spot-paper" />
          <circle cx="65" cy="48" r="4" className="spot-detail" />
          <path d="M45 46h16M69 46h16M65 52v16" className="spot-accent" />
        </>
      ) : kind === "search" ? (
        <>
          <circle cx="65" cy="46" r="17" className="spot-paper" />
          <path d="m78 59 13 13" className="spot-accent" />
          <path d="M59 46h12" className="spot-detail" />
        </>
      ) : (
        <>
          <path d="M52 40v13M32 53h40" className="spot-accent" />
          <rect
            x="21"
            y="53"
            width="22"
            height="16"
            rx="4"
            className="spot-paper"
          />
          <rect
            x="63"
            y="53"
            width="22"
            height="16"
            rx="4"
            className="spot-paper"
          />
        </>
      )}
      <circle cx="88" cy="18" r="4" className="spot-dot" />
    </svg>
  );
}

export function EmptyState({
  kind,
  title,
  children,
}: {
  kind: SpotKind;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className={"product-empty empty-" + kind}>
      <SpotIllustration kind={kind} />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}
