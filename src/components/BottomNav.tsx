"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Sheet from "./Sheet";
import SignOutButton from "./SignOutButton";
import {
  Books,
  Broadcast,
  CalendarBlank,
  Cards,
  Compass,
  DotsThree,
  DownloadSimple,
  House,
  ListBullets,
  MagnifyingGlass,
  Users,
} from "@phosphor-icons/react/ssr";
import { requestSearchOpen } from "@/lib/search-event";

/**
 * The four a person touches dozens of times a session. Everything else lives
 * one tap away rather than crushed into the same strip: six icons across a
 * 390px phone gave each about 60px, and Browse and Feed had no way in at all.
 */
const PRIMARY = [
  { href: "/", label: "Home", Icon: House },
  { href: "/browse", label: "Browse", Icon: Compass },
  { href: "/diary", label: "Diary", Icon: CalendarBlank },
  { href: "/library", label: "Library", Icon: Books },
];

/** Reachable, just not resident. Ordered by how often they are actually opened. */
const SECONDARY = [
  { href: "/watchlist", label: "Watchlist", Icon: ListBullets },
  { href: "/friends", label: "Friends", Icon: Users },
  { href: "/feed", label: "Feed", Icon: Broadcast },
  { href: "/lists", label: "Lists", Icon: Cards },
  { href: "/import", label: "Import", Icon: DownloadSimple },
];


const itemClass =
  "flex min-h-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors [-webkit-tap-highlight-color:transparent] active:bg-tray-2";

/**
 * Thumb-reachable navigation on phones. Hidden from `sm` up, where the top bar
 * has room for the full set of links plus the desktop search button.
 */
export default function BottomNav({
  pendingRequests = 0,
  cardChanged = false,
}: {
  pendingRequests?: number;
  cardChanged?: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // A destination that moved into the sheet must not take its badge with it,
  // or a pending request becomes something you only find by looking for it.
  const inSheet = SECONDARY.some((l) => pathname.startsWith(l.href) && l.href !== "/");

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-seam bg-[rgba(20,20,23,.97)] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden"
      >
        {PRIMARY.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            pathname={pathname}
            dot={item.href === "/" && cardChanged}
          />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More destinations"
          aria-expanded={moreOpen}
          className={`relative ${itemClass}`}
        >
          <span className="relative">
            <DotsThree className={`size-5 ${inSheet ? "text-beam" : "text-ash"}`} />
            {pendingRequests > 0 && (
              <span className="absolute -right-1.5 -top-1 size-2 rounded-full bg-beam" />
            )}
          </span>
          <span className={`text-[10px] ${inSheet ? "text-paper" : "text-ash"}`}>More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Go to">
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {SECONDARY.map(({ href, label, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-2 rounded-card border border-seam bg-tray px-2 py-4 text-center transition-colors active:bg-tray-2"
              >
                <span className="relative">
                  <Icon className="size-5 text-ash" />
                  {href === "/friends" && pendingRequests > 0 && (
                    <span className="num absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-beam px-[3px] text-[9px] font-medium text-carbon">
                      {pendingRequests > 9 ? "9+" : pendingRequests}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-paper">{label}</span>
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                requestSearchOpen();
              }}
              className="flex w-full flex-col items-center gap-2 rounded-card border border-seam bg-tray px-2 py-4 text-center transition-colors active:bg-tray-2"
            >
              <MagnifyingGlass className="size-5 text-ash" />
              <span className="text-[11px] text-paper">Search</span>
            </button>
          </li>
        </ul>

        {/* Settings and sign out are both `hidden sm:` in the header, so on a
            phone this sheet is the only route to either. Sign out had none at
            all: the account could be entered but not left. */}
        <div className="mt-3 flex gap-2">
          <Link
            href="/settings"
            onClick={() => setMoreOpen(false)}
            className="flex-1 rounded-card border border-seam px-4 py-3 text-center text-sm text-ash transition-colors active:bg-tray"
          >
            Settings
          </Link>
          <div className="flex-1 [&>button]:w-full [&>button]:rounded-card [&>button]:border [&>button]:border-seam [&>button]:px-4 [&>button]:py-3 [&>button]:text-sm">
            <SignOutButton />
          </div>
        </div>
      </Sheet>
    </>
  );
}

function NavLink({
  href,
  label,
  Icon,
  pathname,
  badge = 0,
  dot = false,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  pathname: string;
  badge?: number;
  /** an unnumbered mark, for something there is only ever one of */
  dot?: boolean;
}) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`relative ${itemClass}`}>
      <span className="relative">
        <Icon className={`size-5 ${active ? "text-beam" : "text-ash"}`} />
        {dot && (
          <span
            aria-label="Your card changed"
            className="absolute -right-1 -top-0.5 size-2 rounded-full bg-gold"
          />
        )}
        {badge > 0 && (
          <span className="num absolute -right-2 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-beam px-[3px] text-[9px] font-medium text-carbon">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      <span className={`text-[10px] ${active ? "text-paper" : "text-ash"}`}>{label}</span>
    </Link>
  );
}
