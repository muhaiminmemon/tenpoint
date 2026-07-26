"use client";

import { useEffect } from "react";
import { APP_NAME } from "@/lib/brand";

/**
 * The last resort: an error thrown by the root layout itself, before `Nav`,
 * `Footer`, or the fonts exist. It has to render its own `<html>`, and it can
 * rely on nothing above it — hence the inline styles rather than Tailwind
 * classes, which come from a stylesheet the failing layout was meant to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: "#141417",
          color: "#ECEAE6",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "1rem",
        }}
      >
        <div style={{ maxWidth: "24rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 500, margin: 0 }}>
            {APP_NAME} is down
          </h1>
          <p style={{ marginTop: "0.75rem", color: "#9A9AA3", fontSize: "0.875rem" }}>
            Something failed before the page could load. Your data is fine.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              background: "#ECEAE6",
              color: "#141417",
              border: 0,
              borderRadius: "6px",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", color: "#9A9AA3", fontSize: "0.75rem" }}>
              Reference: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
