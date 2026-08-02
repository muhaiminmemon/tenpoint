import { formatTenths } from "@/lib/format";
import type { CriticScores as Scores } from "@/lib/omdb";

/**
 * What everyone else thought, kept firmly beside the point.
 *
 * These are other people's aggregates and they are set at the size of a
 * caption, because the number that matters on this page is the one the reader
 * gives it. A Tomatometer typeset like a verdict would quietly become the
 * score, and the tenths would read as a footnote to it.
 *
 * Nothing is invented when a source is missing: an absent score is simply not
 * printed. There is no "N/A" row and no zero, because a film OMDb has never
 * heard of has not been badly reviewed.
 */
export default function CriticScores({ scores }: { scores: Scores }) {
  const items: { label: string; value: string }[] = [];

  if (scores.rtScore !== null) {
    items.push({ label: "Rotten Tomatoes", value: `${scores.rtScore}%` });
  }
  if (scores.metacritic !== null) {
    items.push({ label: "Metacritic", value: `${scores.metacritic}` });
  }
  if (scores.imdbRating !== null) {
    // Already tenths on the way in, so it formats with the same function every
    // other rating in the app uses and never becomes a float.
    items.push({ label: "IMDb", value: formatTenths(scores.imdbRating) });
  }

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="critics" className="border-t border-seam pt-5">
      <h2 id="critics" className="text-[10px] uppercase tracking-[0.14em] text-ash">
        Elsewhere
      </h2>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <dd className="num text-[19px] leading-none text-paper">{item.value}</dd>
            <dt className="mt-1.5 text-[11px] text-ash">{item.label}</dt>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[11px] text-dim">
        Ratings via OMDb. Not this site&apos;s scale, and not counted in anything here.
      </p>
    </section>
  );
}
