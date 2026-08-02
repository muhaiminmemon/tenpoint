"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Sheet from "./Sheet";
import SignOutButton from "./SignOutButton";
import { requestSearchOpen } from "@/lib/search-event";

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M3 8.5l7-5.5 7 5.5v7a1 1 0 01-1 1h-3.25v-5h-5.5v5H4a1 1 0 01-1-1v-7z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LibraryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.75" y="2.75" width="6" height="6" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.25" y="2.75" width="6" height="6" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.75" y="11.25" width="6" height="6" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.25" y="11.25" width="6" height="6" rx="1.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function DiaryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.75" y="4.25" width="14.5" height="13" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.75 8.25h14.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="8.75" cy="8.75" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16.25 16.25l-3.9-3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function QueueIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M5.25 3.25h9.5a.5.5 0 01.5.5v12.4a.4.4 0 01-.62.33L10 13.2l-4.63 3.28a.4.4 0 01-.62-.33V3.75a.5.5 0 01.5-.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ListsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="3.75" cy="5.5" r="1" fill="currentColor" />
      <circle cx="3.75" cy="10" r="1" fill="currentColor" />
      <circle cx="3.75" cy="14.5" r="1" fill="currentColor" />
      <path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FriendsIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="7.25" cy="6.75" r="2.75" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.5 16.25c.35-3.15 2.35-5 4.75-5s4.4 1.85 4.75 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="14.75" cy="7.5" r="2.15" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12.9 16.25c.28-2.5 1.55-4.05 3.35-4.35"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrowseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <rect x="2.75" y="2.75" width="5.5" height="7.5" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.75" y="2.75" width="5.5" height="5" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.75" y="12.75" width="5.5" height="4.5" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.75" y="10.25" width="5.5" height="7" rx="1.1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function MoreIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <circle cx="4.5" cy="10" r="1.35" fill="currentColor" />
      <circle cx="10" cy="10" r="1.35" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1.35" fill="currentColor" />
    </svg>
  );
}

/**
 * The four a person touches dozens of times a session. Everything else lives
 * one tap away rather than crushed into the same strip: six icons across a
 * 390px phone gave each about 60px, and Browse and Feed had no way in at all.
 */
const PRIMARY = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/browse", label: "Browse", Icon: BrowseIcon },
  { href: "/diary", label: "Diary", Icon: DiaryIcon },
  { href: "/library", label: "Library", Icon: LibraryIcon },
];

/** Reachable, just not resident. Ordered by how often they are actually opened. */
const SECONDARY = [
  { href: "/watchlist", label: "Watchlist", Icon: QueueIcon },
  { href: "/friends", label: "Friends", Icon: FriendsIcon },
  { href: "/feed", label: "Feed", Icon: DiaryIcon },
  { href: "/lists", label: "Lists", Icon: ListsIcon },
  { href: "/import", label: "Import", Icon: LibraryIcon },
];


const itemClass =
  "flex min-h-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors [-webkit-tap-highlight-color:transparent] active:bg-tray-2";

/**
 * Thumb-reachable navigation on phones. Hidden from `sm` up, where the top bar
 * has room for the full set of links plus the desktop search button.
 */
export default function BottomNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // A destination that moved into the sheet must not take its badge with it,
  // or a pending request becomes something you only find by looking for it.
  const inSheet = SECONDARY.some((l) => pathname.startsWith(l.href) && l.href !== "/");

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-seam bg-[rgba(20,20,23,.97)] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden"
      >
        {PRIMARY.map((item) => (
          <NavLink key={item.href} {...item} pathname={pathname} />
        ))}

        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-label="More destinations"
          aria-expanded={moreOpen}
          className={`relative ${itemClass}`}
        >
          <span className="relative">
            <MoreIcon className={`size-5 ${inSheet ? "text-beam" : "text-ash"}`} />
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
              <SearchIcon className="size-5 text-ash" />
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
}: {
  href: string;
  label: string;
  Icon: (p: IconProps) => React.JSX.Element;
  pathname: string;
  badge?: number;
}) {
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`relative ${itemClass}`}>
      <span className="relative">
        <Icon className={`size-5 ${active ? "text-beam" : "text-ash"}`} />
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
