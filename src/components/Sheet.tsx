"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  /** shown in the sheet header and used as the dialog's accessible name */
  title: string;
  /** sits under the title, e.g. the film this sheet is about */
  subtitle?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * One panel, two shapes: a right-hand slide-over from `sm` up, a bottom sheet
 * below it. The page behind stays visible and in place, so logging a viewing
 * never navigates you off the film.
 *
 * Rendered into `document.body` through a portal rather than in place. `fixed`
 * positions against the viewport only while no ancestor establishes a
 * containing block, and a transform does establish one — including a transform
 * that only exists inside an animation's keyframes. The diary's calendar sits
 * inside `.fade-up`, which animates `translateY`, so an in-place sheet was
 * being positioned against the calendar and then clipped by the card's
 * `overflow-hidden`. Portalling fixes that everywhere at once instead of
 * asking every future caller to know which ancestors are safe.
 */
export default function Sheet({ open, onClose, title, subtitle, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;

    // the page behind must not scroll under the sheet
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // keep focus inside the panel while it's open
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    // focus the panel itself so screen readers announce the dialog
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  // A portal contributes nothing where the component sits, so rendering null
  // on the server and a portal on the client leaves the in-place DOM identical
  // and hydration has nothing to reconcile.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="scrim-in absolute inset-0 w-full cursor-default bg-[rgba(8,8,10,.6)] backdrop-blur-[1px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="sheet-in absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[20px] border-t border-seam bg-lift px-4 pb-6 pt-3 shadow-[0_-20px_50px_rgba(0,0,0,.5)] outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[440px] sm:max-w-full sm:rounded-none sm:border-l sm:border-t-0 sm:px-6 sm:py-5 sm:shadow-[-20px_0_60px_rgba(0,0,0,.5)]"
      >
        {/* grab handle reads as "drag me" on touch; decorative on desktop */}
        <div aria-hidden className="mx-auto mb-3.5 h-1 w-9 rounded-full bg-seam sm:hidden" />

        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-[17px] font-medium text-paper sm:text-[19px]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-7 shrink-0 items-center justify-center rounded-card border border-seam text-ash hover:text-paper"
          >
            ×
          </button>
        </div>

        {subtitle && (
          <div className="mt-3.5 border-b border-seam pb-4">{subtitle}</div>
        )}

        {children}
      </div>
    </div>,
    document.body,
  );
}
