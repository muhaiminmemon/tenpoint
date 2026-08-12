"use client";

import { useUrlState } from "@/lib/useUrlState";
import LibraryView from "./LibraryView";
import ProfileDiaryTab from "./ProfileDiaryTab";
import ProfileWatchlistTab from "./ProfileWatchlistTab";
import type { LibraryFilm } from "@/lib/library";
import type { ProfileDiaryRow } from "./ProfileDiaryList";
import type { ProfileWatchlistRow } from "./ProfileWatchlistList";

type Tab = "library" | "diary" | "watchlist";
/** In the URL, so opening a film from the diary tab comes back to the diary tab. */
const TAB_KEYS = ["library", "diary", "watchlist"] as const;

type Props = {
  films: LibraryFilm[];
  diaryRows: ProfileDiaryRow[] | null;
  watchlistRows: ProfileWatchlistRow[] | null;
  editable: boolean;
};

export default function ProfileTabs({
  films,
  diaryRows,
  watchlistRows,
  editable,
}: Props) {
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "library", label: "Library", count: films.length },
    ...(diaryRows ? [{ id: "diary" as const, label: "Diary", count: diaryRows.length }] : []),
    ...(watchlistRows
      ? [{ id: "watchlist" as const, label: "Watchlist", count: watchlistRows.length }]
      : []),
  ];
  const [urlTab, setTab] = useUrlState<Tab>("tab", "library", TAB_KEYS);
  /**
   * A tab in the URL that this profile does not offer falls back to the
   * library. `?tab=diary` is a real link somebody may still hold — from a share,
   * from history, or from before the owner turned their diary off — and honouring
   * it literally would render an empty panel under a strip with no tab selected.
   */
  const tab: Tab = tabs.some((t) => t.id === urlTab) ? urlTab : "library";

  return (
    <div>
      {/* pills that scroll under a thumb on mobile, an underlined strip on desktop */}
      <div
        className="mb-5 mt-6 flex snap-x items-center gap-1.5 overflow-x-auto pb-1 text-sm sm:gap-1 sm:overflow-visible sm:border-b sm:border-seam sm:pb-0"
        role="tablist"
        aria-label="Profile sections"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`num shrink-0 snap-start rounded-full border px-3.5 py-1.5 transition-colors sm:-mb-px sm:rounded-none sm:border-0 sm:border-b-2 sm:px-3 sm:py-2 ${
              tab === t.id
                ? "border-paper bg-paper text-carbon sm:bg-transparent sm:text-paper"
                : "border-seam bg-tray text-ash hover:text-paper sm:border-transparent sm:bg-transparent"
            }`}
          >
            {t.label}{" "}
            <span className={`text-xs ${tab === t.id ? "text-carbon/60 sm:text-ash" : "text-dim"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Keyed on the tab so each panel plays its own entrance rather than the
          content silently swapping under a moved underline. These lists run to
          hundreds of rows, so the height is left alone: easing between a
          twelve-row watchlist and a 900-row library would be a long scroll
          animating for no one's benefit. */}
      <div key={tab} className="pop-in">
        {tab === "library" &&
          (films.length === 0 ? (
            <p className="py-8 text-sm text-ash">No films logged yet.</p>
          ) : (
            <LibraryView films={films} editable={editable} />
          ))}
        {tab === "diary" && diaryRows && (
          <ProfileDiaryTab rows={diaryRows} editable={editable} />
        )}
        {tab === "watchlist" && watchlistRows && (
          <ProfileWatchlistTab rows={watchlistRows} editable={editable} />
        )}
      </div>
    </div>
  );
}
