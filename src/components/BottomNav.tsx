"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

const LINKS_BEFORE_SEARCH = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/library", label: "Library", Icon: LibraryIcon },
  { href: "/diary", label: "Diary", Icon: DiaryIcon },
];

const LINKS_AFTER_SEARCH = [
  { href: "/watchlist", label: "Queue", Icon: QueueIcon },
  { href: "/lists", label: "Lists", Icon: ListsIcon },
  { href: "/friends", label: "Friends", Icon: FriendsIcon },
];

const itemClass =
  "flex min-h-[46px] flex-1 flex-col items-center justify-center gap-1 rounded-lg py-1.5 transition-colors [-webkit-tap-highlight-color:transparent] active:bg-tray-2";

/**
 * Thumb-reachable navigation on phones. Hidden from `sm` up, where the top bar
 * has room for the full set of links plus the desktop search button.
 */
export default function BottomNav({ pendingRequests = 0 }: { pendingRequests?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-seam bg-[rgba(20,20,23,.97)] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden"
    >
      {LINKS_BEFORE_SEARCH.map((item) => (
        <NavLink key={item.href} {...item} pathname={pathname} />
      ))}

      <button type="button" onClick={requestSearchOpen} aria-label="Search films" className={itemClass}>
        <SearchIcon className="size-5 text-ash" />
        <span className="text-[10px] text-ash">Search</span>
      </button>

      {LINKS_AFTER_SEARCH.map((item) => (
        <NavLink
          key={item.href}
          {...item}
          pathname={pathname}
          badge={item.href === "/friends" ? pendingRequests : 0}
        />
      ))}
    </nav>
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
