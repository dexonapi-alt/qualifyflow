import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Native modal keeps the source list mounted and restores its exact focus. */
export function DetailPanel({
  title,
  context,
  onClose,
  children,
}: {
  title: string;
  context: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    const overflow = document.body.style.overflow;
    const padding = document.body.style.paddingRight;
    const gutter = innerWidth - document.documentElement.clientWidth;
    if (gutter)
      document.body.style.paddingRight = `${gutter + parseFloat(getComputedStyle(document.body).paddingRight || "0")}px`;
    document.body.style.overflow = "hidden";
    node.showModal();
    close.current?.focus();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = padding;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className="work-detail-panel"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const targets = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ),
        ].filter(
          (node) =>
            node.getClientRects().length > 0 && !node.closest("[inert]"),
        );
        const first = targets[0],
          last = targets.at(-1);
        if (
          (event.shiftKey && document.activeElement === first) ||
          (!event.shiftKey && document.activeElement === last)
        ) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="work-detail-surface">
        <header className="work-detail-heading">
          <div>
            <p>{context}</p>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button ref={close} className="secondary" onClick={onClose}>
            Close details
          </button>
        </header>
        <div className="work-detail-content">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
