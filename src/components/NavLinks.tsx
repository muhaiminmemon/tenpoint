"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/library", label: "Library" },
  { href: "/diary", label: "Diary" },
  { href: "/feed", label: "Feed" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/lists", label: "Lists" },
  { href: "/friends", label: "Friends" },
  { href: "/import", label: "Import" },
];

export default function NavLinks({
  pendingRequests = 0,
  /** the card moved up and the reader has not looked at it yet */
  cardChanged = false,
}: {
  pendingRequests?: number;
  cardChanged?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-wrap items-center gap-1 text-sm">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-card px-2.5 py-1 transition-colors ${
              active ? "bg-tray-2 text-paper" : "text-ash hover:bg-tray hover:text-paper"
            }`}
          >
            {l.label}
            {/* A dot rather than a count: there is only ever one card, so a
                number would be answering a question nobody asked. */}
            {l.href === "/" && cardChanged && (
              <span
                aria-label="Your card changed"
                className="absolute -right-1 -top-0.5 size-2 rounded-full bg-gold"
              />
            )}
            {l.href === "/friends" && pendingRequests > 0 && (
              <span className="num flex h-4 min-w-4 items-center justify-center rounded-full bg-beam px-1 text-[10px] font-medium text-carbon">
                {pendingRequests > 9 ? "9+" : pendingRequests}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
