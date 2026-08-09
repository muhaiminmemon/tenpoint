import Link from "next/link";
import HomeSearch from "./HomeSearch";
import QuickRateDeck, { type QuickRateFilm } from "./QuickRateDeck";
import HomeTasteCard from "./HomeTasteCard";
import RecentViewings from "./RecentViewings";
import type { HomeTasteCardData } from "@/lib/taste";
import type { RecentViewing } from "@/lib/library";

/**
 * The homepage shell. Same shape for a brand-new account and one with
 * hundreds of films logged — search bar and quick-rate deck never go away.
 * The taste card lives in the same slot the whole time; once it's fully
 * developed it takes over the hero row with the recent viewings beside it,
 * and the import prompt moves to a quieter strip beneath — everything a new
 * account needs stays available, just no longer the co-lead.
 *
 * The card and the list beside it are deliberately different kinds of thing:
 * the card is who someone is, the list is what they have been doing. An
 * earlier version put a stats panel there instead, which restated the card's
 * own figures next to it and left the page with no view of the actual record.
 */
export default function HomeLayout({
  name,
  username,
  displayName,
  avatarUrl,
  userId,
  memberNumber,
  memberSince,
  taste,
  hasFriend,
  quickRateFilms,
  recentViewings,
}: {
  name: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  userId: string;
  memberNumber: number;
  memberSince: number;
  taste: HomeTasteCardData;
  hasFriend: boolean;
  quickRateFilms: QuickRateFilm[];
  recentViewings: RecentViewing[];
}) {
  const isNew = taste.rated === 0;

  return (
    <div className="py-6">
      {/* The greeting used to sit above this as a small-caps kicker, which is
          the one page pattern the floor bans outright. It is not lost: a name
          belongs in the sentence addressed to that person, not in a label
          introducing it. */}
      <h1 className="display text-[32px] font-medium leading-[1.05] text-paper sm:text-[38px]">
        {isNew ? `Let's put the first title on the shelf, ${name}.` : `Add another to the shelf, ${name}.`}
      </h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-ash">
        {isNew
          ? "Everything starts with one rating. Name a film or a show you've seen, and the shelf fills in from there."
          : "Name a film or a show you've seen, or see what's rising to the top below."}
      </p>

      <div className="mt-6">
        <HomeSearch />
      </div>

      {taste.full ? (
        <>
          {/* Both tracks are minmax(0,…) rather than auto or 1fr.
              A grid column defaults to `auto`, which resolves to the widest
              content it holds and will not shrink below it. On a phone that
              made this one column 397px inside a 368px page, and the 13px it
              stuck out was enough to make every fixed-position element and the
              whole document scroll sideways: the card looked oversized and the
              page had to be zoomed out to read. `1fr` has the same failure, as
              its implied minimum is also auto. */}
          {/* 264px, not 220. The card carries three theme names side by side and
              220 left them 184px for a row that wants 261, so they wrapped and
              jammed the edges. The extra 44px comes out of the viewings panel,
              which has room to spare at every width the grid is two columns. */}
          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[264px_minmax(0,1fr)]">
            <HomeTasteCard
              taste={taste}
              username={username}
              displayName={displayName}
              avatarUrl={avatarUrl}
              userId={userId}
              memberNumber={memberNumber}
              memberSince={memberSince}
              hasFriend={hasFriend}
            />
            <RecentViewings viewings={recentViewings} />
          </div>
        </>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-edge bg-carbon p-5">
            <h2 className="display text-xl text-paper">Bring your existing diary</h2>
            <p className="mt-2 text-sm leading-relaxed text-ash">
              Upload the CSV, preview every row, undo anytime. Nothing is written until you confirm.
            </p>
            <Link
              href="/import"
              className="mt-4 inline-block rounded-card border border-beam-edge px-4 py-1.5 text-sm text-beam hover:bg-[#161d24]"
            >
              Import CSV
            </Link>
          </div>

          <HomeTasteCard
            taste={taste}
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            userId={userId}
            memberNumber={memberNumber}
            memberSince={memberSince}
            hasFriend={hasFriend}
          />
        </div>
      )}

      {quickRateFilms.length > 0 && (
        <div className="mt-6">
          <QuickRateDeck pool={quickRateFilms} />
        </div>
      )}
    </div>
  );
}

