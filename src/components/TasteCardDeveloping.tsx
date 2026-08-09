import Link from "next/link";
import TasteStatStrip from "./TasteStatStrip";
import { FULL_CARD_THRESHOLD, type HomeTasteCardData } from "@/lib/taste";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-dim">
      <span
        className="block h-full rounded-full bg-gradient-to-r from-beam to-gold"
        style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
      />
    </span>
  );
}

/**
 * 1–49 rated films: the card between "blank" and "foil". Once the class is
 * named (5 films) it leads with that; below that it's the same stats with a
 * locked-class teaser instead.
 */
export default function TasteCardDeveloping({
  data,
  hasFriend,
}: {
  data: HomeTasteCardData;
  hasFriend: boolean;
}) {
  return (
    <div>
      <div className="rounded-xl border border-edge bg-carbon p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ash">
              {data.archetype ? "Taste class" : "Your taste, developing"}
            </p>
            {data.archetype ? (
              <h3 className="display mt-1 truncate text-xl text-paper">{data.archetype}</h3>
            ) : (
              <p className="mt-1 text-sm text-dim">
                Names itself at 5 titles rated. {5 - data.rated} to go.
              </p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <TasteStatStrip taste={data} />
        </div>

        <div className="mt-4 border-t border-seam pt-3.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-ash">{data.toFull} more unlocks the full card</span>
            <span className="num text-dim">
              {data.rated} / {FULL_CARD_THRESHOLD}
            </span>
          </div>
          <div className="mt-2">
            <ProgressBar pct={(data.rated / FULL_CARD_THRESHOLD) * 100} />
          </div>
        </div>
      </div>

      {data.rated < 5 ? (
        <p className="mt-2.5 text-xs text-ash">
          Rate {5 - data.rated} more to unlock taste-matching with friends.
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
