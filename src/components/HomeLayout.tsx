import Link from "next/link";
import HomeSearch from "./HomeSearch";
import QuickRateDeck, { type QuickRateFilm } from "./QuickRateDeck";
import HomeTasteCard from "./HomeTasteCard";
import type { TasteProfile } from "@/lib/taste";

/**
 * The homepage shell. Same shape for a brand-new account and one with
 * hundreds of films logged — search bar, import card, quick-rate deck never
 * go away. Only the headline and the taste card (in the same slot the whole
 * time) change to reflect what's actually true.
 */
export default function HomeLayout({
  name,
  taste,
  hasFriend,
  quickRateFilms,
}: {
  name: string;
  taste: TasteProfile;
  hasFriend: boolean;
  quickRateFilms: QuickRateFilm[];
}) {
  const isNew = taste.rated === 0;

  return (
    <div className="py-6">
      <p className="display mb-3 text-[13px] uppercase tracking-[0.14em] text-beam">
        Welcome, {name}
      </p>
      <h1 className="display text-[32px] font-medium leading-[1.05] text-paper sm:text-[38px]">
        {isNew ? "Let's put the first film on the shelf." : "Add another to the shelf."}
      </h1>
      <p className="mt-3 max-w-lg text-base leading-relaxed text-ash">
        {isNew
          ? "Everything starts with one rating. Name a film you've seen, and the shelf fills in from there."
          : "Name a film you've seen, or see what's rising to the top below."}
      </p>

      <div className="mt-6">
        <HomeSearch />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-seam bg-carbon p-5">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ash">Coming from elsewhere?</p>
          <h2 className="display mt-2 text-xl text-paper">Import your Letterboxd history</h2>
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

        <HomeTasteCard taste={taste} hasFriend={hasFriend} />
      </div>

      {quickRateFilms.length > 0 && (
        <div className="mt-6">
          <QuickRateDeck pool={quickRateFilms} />
        </div>
      )}
    </div>
  );
}
