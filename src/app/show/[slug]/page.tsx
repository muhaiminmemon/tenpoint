import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { loadShow, derivedScore } from "@/lib/shows";
import { formatTenths, ratingColor } from "@/lib/format";
import { personHref } from "@/lib/browse";
import PosterImg from "@/components/PosterImg";
import SeasonRow from "@/components/SeasonRow";
import CastList from "@/components/CastList";

export async function generateMetadata(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const found = await loadShow(slug);
  return { title: found ? found.show.name : "Show" };
}

const FORM_LABEL: Record<string, string> = {
  anime: "Anime",
  animation: "Animation",
  live_action: "Live action",
};

/**
 * A series, understood through its seasons.
 *
 * The page is deliberately the film page's twin: same poster block, same
 * credits line, same cast list, same reviews below. What is different is the
 * middle, and only the middle. A show is not a film with extra tabs, it is a
 * run of things you rated, so the run is the content and everything else is
 * the same furniture in the same places.
 *
 * There is one score and it is derived. It never appears as something to set,
 * and it is labelled as the average it is, because a second editable number
 * for the same thing would be two opinions allowed to disagree.
 */
export default async function ShowPage(ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const found = await loadShow(slug);
  if (!found) notFound();
  const { show, seasons } = found;

  const user = await getSessionUser();
  const mine = user && seasons.length
    ? await db
        .select({ filmId: diaryEntries.filmId, rating: diaryEntries.rating })
        .from(diaryEntries)
        .where(
          and(
            eq(diaryEntries.userId, user.id),
            inArray(diaryEntries.filmId, seasons.map((s) => s.id)),
            sql`${diaryEntries.rating} is not null`,
          ),
        )
        .orderBy(desc(diaryEntries.createdAt))
    : [];

  // The most recent rating per season, matching how a rating is read everywhere
  // else: a rewatch that was not rated never erases what somebody last thought.
  const rated = new Map<string, number>();
  for (const row of mine) {
    if (row.rating !== null && !rated.has(row.filmId)) rated.set(row.filmId, row.rating);
  }
  const score = derivedScore([...rated.values()]);
  const today = new Date().toISOString().slice(0, 10);

  const run = [show.firstAirYear, show.lastAirYear && show.lastAirYear !== show.firstAirYear ? show.lastAirYear : null]
    .filter(Boolean)
    .join(" to ");
  const meta = [
    FORM_LABEL[show.form ?? ""] ?? null,
    show.genres?.slice(0, 3).join(", ") || null,
    show.status === "Returning Series" ? "Still running" : show.status === "Ended" ? "Ended" : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="w-40 shrink-0 sm:w-52">
        <PosterImg
          posterPath={show.posterPath}
          title={show.name}
          size="w500"
          sizes="(max-width: 640px) 160px, 208px"
          className="fade-up aspect-[2/3] w-full rounded-card"
          priority
        />
      </div>

      <div className="min-w-0 flex-1">
        <h1 className="display text-3xl font-medium leading-tight">
          {show.name} {run && <span className="num text-xl font-normal text-ash">{run}</span>}
        </h1>
        <p className="mt-1 text-sm text-ash">
          {show.creators?.length ? (
            <>
              {show.creators.slice(0, 2).map((name, i) => (
                <span key={name}>
                  {i > 0 && ", "}
                  <Link href={personHref(name)} className="hover:text-paper hover:underline">
                    {name}
                  </Link>
                </span>
              ))}
              {meta.length > 0 && " · "}
            </>
          ) : null}
          {meta.join(" · ")}
        </p>
        {show.overview && <p className="mt-4 max-w-xl text-sm text-ash">{show.overview}</p>}
        <CastList names={show.castNames ?? []} />

        <section aria-labelledby="seasons" className="mt-8">
          <div className="flex items-baseline justify-between gap-4 border-b border-edge pb-2.5">
            <h2 id="seasons" className="display text-[19px] text-paper">
              Seasons
            </h2>
            <span className="flex items-baseline gap-4 text-[12.5px] text-ash">
              {score !== null && (
                // Never "your rating". It is the average of what has been
                // rated, and saying so is what stops it becoming a second
                // opinion somebody has to reconcile with the seasons.
                <span>
                  Your seasons average{" "}
                  <span className={`num text-[15px] ${ratingColor(score)}`}>
                    {formatTenths(score)}
                  </span>
                </span>
              )}
              {show.voteAverage !== null && (
                <span className="text-dim">
                  Audience <span className="num text-[15px] text-ash">{formatTenths(show.voteAverage)}</span>
                </span>
              )}
            </span>
          </div>

          {seasons.length === 0 ? (
            <p className="py-6 text-sm text-ash">No seasons on file for this one yet.</p>
          ) : (
            <ul className="mt-1">
              {seasons.map((s) => (
                <SeasonRow
                  key={s.id}
                  href={`/film/${s.slug}`}
                  label={s.title.replace(`${show.name}: `, "")}
                  episodes={s.episodeCount}
                  year={s.year}
                  rating={rated.get(s.id) ?? null}
                  unaired={Boolean(s.releaseDate && s.releaseDate > today)}
                />
              ))}
            </ul>
          )}

          {!user && (
            <p className="mt-4 text-sm text-ash">
              <Link href="/login" className="text-paper underline">
                Sign in
              </Link>{" "}
              to rate a season.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
