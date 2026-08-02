import Link from "next/link";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import type { MutualLove } from "@/lib/taste";

/**
 * Where two people's records actually meet.
 *
 * Two averages printed side by side and the films you both rated highly —
 * facts either person could check. Deliberately not a compatibility figure:
 * the product never renders a fit score, because a single number implies a
 * precision the comparison doesn't have and turns a shared taste into a
 * ranking. Seeing the same four films in both libraries says more than "82%"
 * ever could, and it says something true.
 */
export default function ProfileOverlap({
  viewerMean,
  theirMean,
  theirName,
  mutual,
}: {
  viewerMean: number | null;
  theirMean: number | null;
  theirName: string;
  mutual: MutualLove[];
}) {
  if (viewerMean === null && theirMean === null && mutual.length === 0) return null;

  return (
    <section aria-labelledby="overlap" className="mt-10 border-t border-seam pt-7">
      <h2 id="overlap" className="text-[10px] uppercase tracking-[0.14em] text-ash">
        You two
      </h2>

      <div className="mt-4 flex flex-wrap items-baseline gap-x-10 gap-y-4">
        <Mean label="You" value={viewerMean} />
        <Mean label={theirName} value={theirMean} />
      </div>

      {mutual.length > 0 ? (
        <div className="mt-7">
          <div className="text-[10px] uppercase tracking-[0.14em] text-ash">
            Both rated 8.0 or higher
          </div>
          <ul className="mt-3 flex flex-wrap gap-2.5">
            {mutual.map((m) => {
              const poster = posterUrl(m.posterPath, "w154");
              return (
                <li key={m.slug}>
                  <Link
                    href={`/film/${m.slug}`}
                    className="group block w-[68px]"
                    title={`${m.title} — you ${formatTenths(m.mine)}, ${theirName} ${formatTenths(m.theirs)}`}
                  >
                    <span
                      className="relative block overflow-hidden rounded-[5px] border border-seam bg-tray"
                      style={{ aspectRatio: "2/3" }}
                    >
                      {poster && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
                      )}
                    </span>
                    <span className="mt-1.5 flex items-baseline justify-between gap-1">
                      <span className={`num text-[11px] ${ratingColor(m.mine)}`}>
                        {formatTenths(m.mine)}
                      </span>
                      <span className={`num text-[11px] ${ratingColor(m.theirs)}`}>
                        {formatTenths(m.theirs)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2.5 text-[11px] text-dim">Your rating left, theirs right.</p>
        </div>
      ) : (
        <p className="mt-5 max-w-[46ch] text-sm text-ash">
          Nothing you have both rated highly yet. It fills in as your libraries overlap.
        </p>
      )}
    </section>
  );
}

function Mean({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div
        className={`num text-[26px] leading-none ${value === null ? "text-dim" : ratingColor(value)}`}
      >
        {value === null ? "—" : formatTenths(value)}
      </div>
      <div className="mt-1.5 max-w-[16ch] truncate text-[10px] uppercase tracking-[0.14em] text-ash">
        {label}
      </div>
    </div>
  );
}
