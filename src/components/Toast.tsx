"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";

export type ToastTone = "ok" | "warn" | "info";

export type Toast = {
  id: number;
  /** main line; kept short enough to read in a glance */
  message: React.ReactNode;
  /**
   * Optional heading above the message. Without it the toast stays one line,
   * which is what most confirmations want — a title that only restates the
   * message is two lines saying one thing.
   */
  title?: string;
  /** optional follow-through, e.g. "View in diary" */
  action?: { label: string; href: string };
  tone?: ToastTone;
};

type Ctx = { toast: (t: Omit<Toast, "id">) => void };

const ToastContext = createContext<Ctx | null>(null);

/** Confirms an action without a page refresh. Safe to call from any client component. */
export function useToast(): Ctx {
  const ctx = useContext(ToastContext);
  // A component may render outside the provider (e.g. in a test); no-op rather than throw.
  return ctx ?? { toast: () => {} };
}

const DURATION = 5000;
/** matches `.toast-out` in globals.css */
const EXIT_MS = 180;

/**
 * The accent per tone, drawn from the app's own palette rather than a generic
 * traffic-light set. A confirmation here should look like it belongs to the
 * same product as the rating colours, not like a framework's default green.
 */
const TONE: Record<ToastTone, { accent: string; wash: string }> = {
  ok: { accent: "#8fbf7f", wash: "rgba(143,191,127,.13)" },
  warn: { accent: "#c4756a", wash: "rgba(196,117,106,.14)" },
  info: { accent: "#8faecc", wash: "rgba(143,174,204,.13)" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = nextId.current++;
    // at most three on screen; the oldest falls off rather than stacking forever
    setItems((list) => [...list, { ...t, id }].slice(-3));
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Lifted clear of the mobile bottom nav, which is fixed at the bottom
          edge — a confirmation landing behind the tab bar is a confirmation
          nobody reads. From `sm` the nav is gone and the stack sits low left. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[max(5.25rem,calc(env(safe-area-inset-bottom)+5rem))] z-50 flex flex-col items-center gap-2.5 px-4 sm:bottom-0 sm:items-start sm:p-6"
      >
        {items.map((t) => (
          <ToastRow key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const tone = TONE[toast.tone ?? "ok"];

  useEffect(() => {
    const timer = setTimeout(() => setLeaving(true), DURATION);
    return () => clearTimeout(timer);
  }, []);

  // Removal is deferred until the exit has played. Previously the row was
  // pulled from the list the moment its timer fired, so a toast that took
  // 240ms to arrive vanished in a single frame.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => onDismiss(toast.id), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, onDismiss, toast.id]);

  return (
    <div
      role="status"
      className={`${leaving ? "toast-out" : "toast-in"} pointer-events-auto flex w-full max-w-[400px] items-start gap-3.5 rounded-[14px] border border-seam bg-tray px-4 py-3.5 shadow-[0_16px_44px_rgba(0,0,0,.55),0_2px_6px_rgba(0,0,0,.4)]`}
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: tone.wash }}
      >
        <ToneIcon tone={toast.tone ?? "ok"} color={tone.accent} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && (
          <p className="display text-[14px] font-medium leading-tight text-paper">{toast.title}</p>
        )}
        <p
          className={`text-[13px] leading-snug ${toast.title ? "mt-1 text-ash" : "text-paper"}`}
        >
          {toast.message}
        </p>
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={() => setLeaving(true)}
            className="mt-2 inline-block text-[13px] text-beam hover:underline"
          >
            {toast.action.label}
          </Link>
        )}
      </div>

      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-card text-dim transition-colors hover:text-paper"
      >
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Drawn, not typed. The previous toast used "✓" and "!" as its icons, which
 * meant the mark changed shape with the font and never matched the stroke
 * weight of anything else in the app. One viewBox, one stroke width, one join.
 */
function ToneIcon({ tone, color }: { tone: ToastTone; color: string }) {
  const shared = {
    viewBox: "0 0 24 24",
    className: "size-[19px]",
    fill: "none",
    stroke: color,
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (tone === "warn") {
    return (
      <svg {...shared} aria-hidden>
        <circle cx="12" cy="12" r="9.25" />
        <path d="M12 7.75v5" />
        <path d="M12 16.25v.01" />
      </svg>
    );
  }
  if (tone === "info") {
    return (
      <svg {...shared} aria-hidden>
        <circle cx="12" cy="12" r="9.25" />
        <path d="M12 11v5.25" />
        <path d="M12 7.75v.01" />
      </svg>
    );
  }
  return (
    <svg {...shared} aria-hidden>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M8.25 12.3l2.6 2.6 4.9-5.2" />
    </svg>
  );
}
