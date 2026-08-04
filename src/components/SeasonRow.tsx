import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { formatTenths, ratingColor } from "@/lib/format";

/**
 * One season, on the show page.
 *
 * A row rather than a card, because a show is a run of seasons and a run reads
 * as a list. Cards would turn eight seasons of Game of Thrones into a wall of
 * boxes and lose the one thing the layout is for: seeing the shape of a show
 * decline or climb, in one glance, down the right-hand column.
 *
 * The rating is the only thing right-aligned, so that column is a legible
 * sequence. Everything else stays left, and an unrated season leaves the
 * column empty rather than filling it with a dash, because a gap in a run is
 * itself information.
 */
export default function SeasonRow({
  href,
  label,
  episodes,
  year,
  rating,
  unaired,
}: {
  href: string;
  label: string;
  episodes: number | null;
  year: number | null;
  rating: number | null;
  unaired: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 border-b border-seam px-1 py-3.5 transition-colors last:border-0 hover:bg-tray focus-visible:bg-tray focus-visible:outline-none"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-paper">{label}</span>
          <span className="num mt-0.5 block text-[12px] text-ash">
            {[
              year,
              episodes ? `${episodes} ${episodes === 1 ? "episode" : "episodes"}` : null,
              unaired ? "Not aired yet" : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </span>
        </span>

        {rating !== null ? (
          <span className={`num shrink-0 text-[19px] ${ratingColor(rating)}`}>
            {formatTenths(rating)}
          </span>
        ) : (
          <span className="shrink-0 text-[12.5px] text-dim opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            Rate
          </span>
        )}

        <CaretRight aria-hidden className="size-3.5 shrink-0 text-dim" />
      </Link>
    </li>
  );
}
