import Link from "next/link";
import { personHref } from "@/lib/browse";

/**
 * Who is in it, and a way out through any of them.
 *
 * A film page that names a director and stops is a dead end wearing a credit:
 * the one thing somebody reliably wants after "who was that" is everything
 * else that person is in, and until now the only route to it was retyping the
 * name into the search box. Every name here is the browse query it would have
 * taken, already built.
 *
 * Names only, because names are all the catalogue stores. Headshots would mean
 * a person table, a second image pipeline and ten more requests per page, and
 * the version with faces is not ten times better at answering "what else has
 * she done".
 *
 * Billing order is kept exactly as TMDB gives it. Sorting alphabetically would
 * throw away the one piece of information the order carries, which is who the
 * film is actually about.
 */
export default function CastList({ names }: { names: string[] }) {
  const cast = names.filter(Boolean);
  if (cast.length === 0) return null;

  return (
    <section aria-labelledby="cast" className="mt-6">
      <h2 id="cast" className="text-[11px] uppercase tracking-[0.16em] text-dim">
        Cast
      </h2>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {cast.map((name) => (
          <li key={name}>
            <Link
              href={personHref(name)}
              className="block rounded-full border border-seam px-3 py-1.5 text-[13px] text-ash transition-colors hover:border-dim hover:text-paper focus-visible:border-beam focus-visible:outline-none"
            >
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
