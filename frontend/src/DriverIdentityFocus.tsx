import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { inProfileFocusRegion, type FocusPoint } from "./profileFocusRegion";

type Frame = { left: number; top: number; width: number; height: number };
const ease = [0.22, 1, 0.36, 1] as const;

function CenteredIdentity({
  origin,
  name,
  children,
  onDismiss,
  source,
  autoReturn,
}: {
  origin: Frame;
  name: string;
  children: ReactNode;
  onDismiss: (automatic: boolean) => void;
  source: RefObject<HTMLElement | null>;
  autoReturn: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    position = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null),
    closing = useRef(false);
  const pointer = useRef<FocusPoint | null>(null),
    hoverActive = useRef(autoReturn);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const exitVersion = useRef(0),
    automaticExit = useRef(false);
  const controls = useAnimationControls(),
    reduced = useReducedMotion();
  const [isClosing, setClosing] = useState(false);
  useLayoutEffect(() => {
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    element.showModal();
    if (scrollbar > 0)
      document.body.style.paddingRight = `${parseFloat(getComputedStyle(document.body).paddingRight) + scrollbar}px`;
    document.body.style.overflow = "hidden";
    const target = position.current!.getBoundingClientRect();
    controls.set(
      reduced
        ? { x: 0, y: 0, scaleX: 1, scaleY: 1 }
        : {
            x: origin.left - target.left,
            y: origin.top - target.top,
            scaleX: origin.width / target.width,
            scaleY: origin.height / target.height,
          },
    );
    void controls.start({
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      transition: { duration: reduced ? 0 : 0.34, ease },
    });
    panel.current?.focus({ preventScroll: true });
    return () => {
      controls.stop();
      clearTimeout(leaveTimer.current);
      exitVersion.current += 1;
      element.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
    };
  }, [controls, origin, reduced]);
  async function dismiss(automatic = false) {
    clearTimeout(leaveTimer.current);
    automaticExit.current = automatic;
    if (closing.current) return;
    const version = ++exitVersion.current;
    closing.current = true;
    setClosing(true);
    const home = source.current?.getBoundingClientRect(),
      target = position.current?.getBoundingClientRect();
    if (home && target && !reduced)
      await controls.start({
        x: home.left - target.left,
        y: home.top - target.top,
        scaleX: home.width / target.width,
        scaleY: home.height / target.height,
        transition: { duration: 0.24, ease },
      });
    if (closing.current && version === exitVersion.current)
      onDismiss(automatic);
  }
  function inside() {
    const home = source.current?.getBoundingClientRect(),
      center = position.current?.getBoundingClientRect();
    return !!(
      pointer.current &&
      home &&
      center &&
      inProfileFocusRegion(pointer.current, home, center)
    );
  }
  function queueReturn() {
    if (!hoverActive.current || closing.current || leaveTimer.current) return;
    leaveTimer.current = setTimeout(() => {
      leaveTimer.current = undefined;
      if (hoverActive.current && !inside()) void dismiss(true);
    }, 150);
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="profile-center-dialog"
      data-closing={isClosing || undefined}
      aria-label={"Driver profile for " + name}
      onPointerMove={(event) => {
        if (event.pointerType !== "mouse" || !hoverActive.current) return;
        pointer.current = { x: event.clientX, y: event.clientY };
        if (inside()) {
          clearTimeout(leaveTimer.current);
          leaveTimer.current = undefined;
          if (closing.current && automaticExit.current) {
            exitVersion.current += 1;
            closing.current = false;
            setClosing(false);
            void controls.start({
              x: 0,
              y: 0,
              scaleX: 1,
              scaleY: 1,
              transition: { duration: reduced ? 0 : 0.22, ease },
            });
          }
        } else queueReturn();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          pointer.current = null;
          queueReturn();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        void dismiss();
      }}
      onKeyDown={(event) => {
        hoverActive.current = false;
        clearTimeout(leaveTimer.current);
        leaveTimer.current = undefined;
        if (event.key !== "Tab") return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ].filter((item) => item.getClientRects().length > 0);
        const first = items[0],
          last = items[items.length - 1];
        if (document.activeElement === panel.current) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        pointer.current = { x: event.clientX, y: event.clientY };
        if (hoverActive.current && inside()) return;
        void dismiss();
      }}
    >
      <div ref={position} className="profile-stage-positioner">
        <motion.aside
          ref={panel}
          tabIndex={-1}
          animate={controls}
          className="driver-person-panel profile-center-card"
          style={{ transformOrigin: "0 0" }}
          aria-label="Focused driver identity"
        >
          {children}
          <button
            className="profile-center-return"
            aria-label="Close driver profile"
            onClick={() => void dismiss()}
          >
            Return to profile
          </button>
        </motion.aside>
      </div>
    </dialog>,
    document.body,
  );
}

/** Preserve the source footprint as an invisible hover region while the card is centered. */
export function DriverIdentityFocus({
  name,
  children,
}: {
  name: string;
  children: (expand: () => void, expanded: boolean) => ReactNode;
}) {
  const source = useRef<HTMLElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null);
  const openingPointer = useRef<string | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [origin, setOrigin] = useState<Frame | null>(null);
  const [autoReturn, setAutoReturn] = useState(false);
  const reduced = useReducedMotion();
  const cancelHover = () => {
    clearTimeout(timer.current);
  };
  useLayoutEffect(() => () => cancelHover(), []);
  function expand(fromHover = false) {
    cancelHover();
    if (origin || !source.current || document.querySelector("dialog[open]"))
      return;
    trigger.current = source.current.querySelector<HTMLButtonElement>(
      ".profile-expand-button",
    );
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const { left, top, width, height } = source.current.getBoundingClientRect();
    setAutoReturn(fromHover);
    setOrigin({ left, top, width, height });
  }
  return (
    <>
      <aside
        ref={source}
        className="driver-person-panel profile-focus-source"
        aria-label="Driver identity"
        onFocusCapture={cancelHover}
        onPointerDownCapture={(event) => {
          openingPointer.current = event.pointerType;
        }}
        onKeyDownCapture={() => {
          openingPointer.current = null;
        }}
        style={{ visibility: origin ? "hidden" : undefined }}
        onPointerEnter={(event) => {
          if (
            event.pointerType !== "mouse" ||
            reduced ||
            !matchMedia(
              "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
            ).matches ||
            source.current?.contains(document.activeElement)
          )
            return;
          timer.current = setTimeout(() => expand(true), 160);
        }}
        onPointerLeave={cancelHover}
      >
        {children(() => expand(openingPointer.current === "mouse"), false)}
      </aside>
      {origin && (
        <CenteredIdentity
          origin={origin}
          name={name}
          source={source}
          autoReturn={autoReturn}
          onDismiss={(automatic) => {
            setOrigin(null);
            requestAnimationFrame(() => {
              if (!automatic) trigger.current?.focus({ preventScroll: true });
              else if (
                previousFocus.current?.isConnected &&
                !source.current?.contains(previousFocus.current)
              )
                previousFocus.current.focus({ preventScroll: true });
              else if (source.current?.contains(document.activeElement))
                (document.activeElement as HTMLElement).blur();
            });
          }}
        >
          {children(() => {}, true)}
        </CenteredIdentity>
      )}
    </>
  );
}
