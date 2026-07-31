import Link from "next/link";
import TasteCard from "./TasteCard";
import type { TasteProfile } from "@/lib/taste";

/**
 * Lives on the homepage permanently, not just while onboarding. Empty at
 * first, then the same fields `TasteCard` already reveals on a profile
 * (average, favourite decade, genres, the director you keep returning to)
 * fill in on their own as you rate more, no separate finish line to cross.
 */
export default function HomeTasteCard({
  taste,
  hasFriend,
}: {
  taste: TasteProfile;
  hasFriend: boolean;
}) {
  if (taste.rated === 0) {
    return (
      <div className="rounded-xl border border-seam bg-carbon p-5">
        <p className="text-[11px] uppercase tracking-[0.14em] text-ash">Your taste</p>
        <p className="mt-2 text-sm text-ash">
          Rate your first film and this card starts filling in: your average, your favourite
          decade, the genres you keep coming back to.
        </p>
      </div>
    );
  }

  return (
    <div>
      <TasteCard taste={taste} />
      {taste.rated < 5 ? (
        <p className="mt-2.5 text-xs text-ash">
          Rate {5 - taste.rated} more to unlock taste-matching with friends.
        </p>
      ) : !hasFriend ? (
        <p className="mt-2.5 text-xs text-ash">
          Taste-matching is on.{" "}
          <Link href="/friends" className="text-beam hover:underline">
            Find a friend
          </Link>{" "}
          to compare.
        </p>
      ) : null}
    </div>
  );
}
