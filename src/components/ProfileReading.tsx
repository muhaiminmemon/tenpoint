import Link from "next/link";
import RatingHistogram from "./RatingHistogram";
import { decadeLabel, formatTenths, ratingColor } from "@/lib/format";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * What the card says, in words, beside the card.
 *
 * The card is an object and reads at a glance; this is the part someone can
 * actually quote back. It leads with the archetype because that is the one
 * line that answers "who is this", then gives the two figures the product is
 * built on, then the shape of the scale itself.
 *
 * The histogram is the piece a five-star app structurally cannot show. How
 * someone spreads a hundred possible values is a more honest portrait than any
 * average, and it is the fastest way to tell a generous rater from a narrow
 * one without printing a judgement about either.
 */
export default function ProfileReading({
  data,
  binderHref,
}: {
  data: HomeTasteCardData;
  /** set only when the viewer is allowed to browse this person's binder */
  binderHref?: string;
}) {
  const facts: { label: string; value: string }[] = [];
  if (data.topDecade) facts.push({ label: "Home decade", value: decadeLabel(data.topDecade.decade) });
  if (data.topDirector) {
    facts.push({ label: "Returns to", value: data.topDirector.name });
  }

  return (
    <div className="min-w-0 flex-1">
      {data.archetype && (
        <>
          <h2 className="display text-[28px] leading-[1.05] text-paper sm:text-[32px]">
            {data.archetype}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ash">{data.archetypeMeaning}</p>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-baseline gap-x-9 gap-y-4">
        {/* Works, not rows. This counted every season of every series, so a
            profile could say 308 titles beside a shelf showing 252: the same
            library, told twice, by two different rules. A series is one title
            here however many seasons it took, which is what the shelf, the
            headline count and the card's own mix all already say. */}
        <Figure label="Titles rated" value={String(data.mix.films + data.mix.shows)} />
        {data.mean !== null && (
          <Figure
            label="Average"
            value={formatTenths(data.mean)}
            className={ratingColor(data.mean)}
          />
        )}
        <Figure label="Finish" value={`${data.tier.name} · ${data.variant.name || "Bare"}`} small />
      </div>

      {data.ratings.length >= 3 && (
        <div className="mt-7 border-t border-seam pt-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-ash">
            How they use the scale
          </div>
          <RatingHistogram ratings={data.ratings} />
        </div>
      )}

      {(data.topGenres.length > 0 || facts.length > 0) && (
        <div className="mt-6 flex flex-wrap gap-x-9 gap-y-4">
          {data.topGenres.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ash">Leading genres</div>
              <div className="mt-1.5 text-[15px] text-paper">
                {data.topGenres.slice(0, 3).map((g) => g.name).join(" · ")}
              </div>
            </div>
          )}
          {facts.map((f) => (
            <div key={f.label}>
              <div className="text-[10px] uppercase tracking-[0.14em] text-ash">{f.label}</div>
              <div className="mt-1.5 text-[15px] text-paper">{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {binderHref && (
        <Link
          href={binderHref}
          className="mt-7 inline-flex items-center gap-2 rounded-card border border-seam px-4 py-2 text-sm text-ash transition-colors hover:border-dim hover:text-paper"
        >
          Open their binder
        </Link>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  className = "text-paper",
  small = false,
}: {
  label: string;
  value: string;
  className?: string;
  small?: boolean;
}) {
  return (
    <div>
      <div
        className={`num leading-none ${small ? "text-[15px]" : "text-[30px]"} ${className}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-ash">{label}</div>
    </div>
  );
}
