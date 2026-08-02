"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import Sheet from "./Sheet";

/**
 * A confirmation the app owns, replacing `window.confirm`.
 *
 * The native dialog is suppressed outright in several places people actually
 * browse from: iOS in-app webviews, standalone home-screen apps, and anything
 * with aggressive dialog blocking. When it is suppressed it does not throw, it
 * returns `false` — so a delete button silently did nothing, which reads as a
 * broken button rather than a cancelled action.
 *
 * It also looked wrong. A white system alert in a dark app is the one piece of
 * chrome the design never got to touch.
 *
 * The API is deliberately shaped like the thing it replaces, so a call site
 * reads the same way:
 *
 *     if (!(await confirm({ title: "Delete this viewing?" }))) return;
 */

export type ConfirmOptions = {
  title: string;
  /** the consequence, in a sentence; omitted when the title says everything */
  body?: string;
  /** the destructive verb, e.g. "Delete" */
  action?: string;
  /** false for an ordinary choice that destroys nothing */
  destructive?: boolean;
};

type Ctx = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Ctx | null>(null);

/**
 * Falls back to `window.confirm` outside the provider rather than throwing, so
 * a component rendered in isolation still behaves.
 */
export function useConfirm(): Ctx {
  const ctx = useContext(ConfirmContext);
  return ctx ?? (async (o) => window.confirm(o.title));
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Ctx>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  // Closing by any route — the button, the scrim, Escape — is a decline. A
  // dialog that resolves to nothing would leave the caller awaiting forever.
  const settle = useCallback((ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Sheet
        open={options !== null}
        onClose={() => settle(false)}
        title={options?.title ?? ""}
      >
        {options?.body && (
          <p className="mt-3 max-w-[46ch] text-sm leading-relaxed text-ash">{options.body}</p>
        )}
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={() => settle(false)}
            className="flex-1 rounded-card border border-seam py-2.5 text-sm text-ash transition-colors hover:text-paper"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => settle(true)}
            className={`display flex-1 rounded-card py-2.5 text-sm font-medium transition-colors ${
              options?.destructive === false
                ? "bg-paper text-carbon hover:bg-white"
                : "bg-warn text-carbon hover:brightness-110"
            }`}
          >
            {options?.action ?? "Delete"}
          </button>
        </div>
      </Sheet>
    </ConfirmContext.Provider>
  );
}
