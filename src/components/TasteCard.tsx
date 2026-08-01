import Link from "next/link";
import { decadeLabel, formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import type { MutualLove, TasteProfile } from "@/lib/taste";

type Props = {
  taste: TasteProfile;
  /** shown when viewing someone else's profile */
  compare?: {
    viewerMean: number | null;
    viewerName: string;
    theirName: string;
    mutual: MutualLove[];
  };
};

/** Who someone is, in one glance: what they watch, how they rate, what they love. */
export default function TasteCard({ taste, compare }: Props) {
  if (!taste.rated) return null;

  return (
    <div className="rounded-lg border border-seam bg-lift p-4">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <Stat label="Rated">
          <span className="num text-2xl text-paper">{taste.rated}</span>
        </Stat>
        {taste.mean !== null && (
          <Stat label="Average">
            <span className={`num text-2xl ${ratingColor(taste.mean)}`}>
              {formatTenths(taste.mean)}
            </span>
          </Stat>
        )}
        {taste.topDecade && (
          <Stat label="Favourite decade">
            <span className="num text-2xl text-paper">{decadeLabel(taste.topDecade.decade)}</span>
          </Stat>
        )}
        {taste.topGenres.length > 0 && (
          <Stat label="Genres">
            <span className="flex flex-wrap gap-1.5 pt-1">
              {taste.topGenres.slice(0, 3).map((g) => (
                <span
                  key={g.name}
                  className="rounded-full border border-seam bg-tray px-2.5 py-0.5 text-xs text-paper"
                >
                  {g.name}
                </span>
              ))}
            </span>
          </Stat>
        )}
      </div>

      {taste.topDirector && (
        <p className="mt-3.5 border-t border-seam pt-3 text-sm text-ash">
          Comes back to{" "}
          <span className="text-paper">{taste.topDirector.name}</span>{" "}
          <span className="num text-dim">({taste.topDirector.count} films above their average)</span>
        </p>
      )}

      {compare && (
        <div className="mt-3.5 border-t border-seam pt-3.5">
          <div className="flex items-center gap-4">
            <span className="text-[11px] uppercase tracking-[0.14em] text-ash">Side by side</span>
            <span className="flex items-baseline gap-2 text-sm">
              <span className="text-dim">{compare.viewerName}</span>
              <span className="num text-paper">
                {compare.viewerMean !== null ? formatTenths(compare.viewerMean) : "not rated yet"}
              </span>
              <span className="text-seam">vs</span>
              <span className="text-dim">{compare.theirName}</span>
              <span className="num text-paper">
                {taste.mean !== null ? formatTenths(taste.mean) : "not rated yet"}
              </span>
            </span>
          </div>

          {compare.mutual.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 text-[11px] uppercase tracking-[0.14em] text-ash">
                You both love
              </div>
              <ul className="flex flex-wrap gap-2">
                {compare.mutual.map((m) => {
                  const poster = posterUrl(m.posterPath, "w154");
                  return (
                    <li key={m.slug}>
                      <Link
                        href={`/film/${m.slug}`}
                        title={`${m.title} · you ${formatTenths(m.mine)} · them ${formatTenths(
                          m.theirs,
                        )}`}
                        className="block w-14"
                      >
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={poster}
                            alt={m.title}
                            loading="lazy"
                            className="aspect-[2/3] w-full rounded-[4px] bg-tray object-cover"
                          />
                        ) : (
                          <span className="flex aspect-[2/3] w-full items-center justify-center rounded-[4px] bg-tray p-1 text-center text-[10px] text-ash">
                            {m.title}
                          </span>
                        )}
                        <span className="num mt-1 flex justify-between text-[10px] text-dim">
                          <span>{formatTenths(m.mine)}</span>
                          <span>{formatTenths(m.theirs)}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-0.5 text-[11px] uppercase tracking-[0.14em] text-ash">{label}</div>
      {children}
    </div>
  );
}
