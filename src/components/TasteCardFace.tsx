import { Instrument_Serif } from "next/font/google";
import FoilLight, { CARD_FOIL } from "./FoilLight";
import CardGrain, { CARD_GRAIN } from "./CardGrain";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { stockDef } from "@/lib/taste-card";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * The archetype's own face, and the only place in the product that has one.
 *
 * Space Grotesk and IBM Plex Sans carry everything else here; this line is the
 * exception because it is the one thing on the card that is a *name* rather
 * than a field, and neither of those two faces can say a name. Italic only —
 * it is the single cut the card uses, so nothing else is fetched.
 *
 * Self-hosted by next/font at build time: no third-party request, and `swap`
 * against the Plex fallback rather than invisible text while it loads.
 */
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

/**
 * The archetype is two voices only if it has two parts.
 *
 * A one-word archetype must not render as a lone tracked label with no name
 * under it, so when there is no rest the first word takes the serif itself.
 * A three-word one ("Deepcut Final Girl") keeps everything after the first
 * word together — the split is first-word versus the rest, never word-by-word.
 *
 * Nullable because a library too thin to have an archetype yet has none, and
 * that case prints nothing rather than an empty serif line.
 */
function splitTitle(title: string | null): { first: string; rest: string } {
  const parts = (title ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", rest: parts.slice(1).join(" ") };
}

function Stars({ mean }: { mean: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(mean / 20)));
  return (
    <span className="num text-[10px] tracking-[0.1em] text-gold">
      {"★".repeat(filled)}
      <span className="text-seam">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

/**
 * The card itself: rim, ground, finish and everything printed on the front.
 *
 * Extracted so the homepage and a profile show the same object rather than two
 * near-copies that drift. Only the chrome around it differs — home wraps it in
 * share and view actions, a profile does not — and nothing in here knows or
 * cares which page it is on.
 *
 * Presentational and hook-free, so it renders on the server when its parent
 * lets it.
 */
export default function TasteCardFace({
  data,
  username,
  displayName,
  avatarUrl,
  memberSince,
  /** the one-time re-mint flash; only the owner's own homepage passes it */
  flashing = false,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberSince: number;
  flashing?: boolean;
}) {
  const { tier, variant } = data;
  const stock = stockDef(variant.stock);
  const title = splitTitle(data.archetype);
  // Genres only until a library is big enough for a theme to emerge.
  /**
   * Chosen by distinctiveness, printed by share.
   *
   * The themes are picked for how far past ordinary each sits, but the card
   * prints the plain figure: what portion of the shelf each one fills. So the
   * three are sorted by that same figure, because whatever number is on the
   * page has to be the one the order is in. The multiple that chose them is a
   * binder fact, not a card fact.
   */
  const chips = (
    data.themeDNA.length > 0
      ? data.themeDNA
      : data.genreShare.map((g) => ({ ...g, lift: 0 }))
  )
    .slice(0, 3)
    .sort((a, b) => b.pct - a.pct);

  const name = (
    <span
      className={`block text-[38px] leading-[0.95] tracking-[-0.01em] text-paper ${instrument.className}`}
    >
      {title.rest || title.first}
    </span>
  );

  // Two materials, one per axis the card actually has. The rim is the tier,
  // because rarity should stay the loudest signal; the ground is the stock.
  // Nothing decorative sits between them — a third material with no axis
  // behind it would be a finish the binder can't explain.
  return (
      <div
        className="relative overflow-hidden"
        style={{ background: stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)" }}
      >
        {stock?.texture && (
          <span aria-hidden className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
        )}
        {/* Sits above the grain and the foil, so the sweep reads as light
            crossing the finished surface rather than another layer under it. */}
        {flashing && <span aria-hidden className="card-remint z-20" />}
        <CardGrain intensity={tier.sheenOp} strength={CARD_GRAIN} />
        <FoilLight intensity={tier.sheenOp * CARD_FOIL} sweepSec={tier.sweepSec} />

        {/* The plate.
         *
         * The archetype is the object, not a line inside a stack of fields.
         * Everything that identifies the holder — handle, date, rating, tier —
         * demotes to the margins at the card's smallest steps, so the name is
         * the only thing read from across a room. This is the one card element
         * that is a name rather than a field, and it is now sized like it. */}
        <div className="relative flex flex-col px-4 pb-4 pt-[18px]">
          <div className="flex items-baseline justify-between gap-2 text-[9px] uppercase tracking-[0.14em]">
            <span className="display tracking-[0.06em] text-card-2">@{username}</span>
            <span className="num text-card-3">Since {memberSince}</span>
          </div>

          {/* Two voices, and which one is which is the point.
           *
           * The first word is the classification — "Deepcut", "Midnight" — so
           * it prints as a tracked uppercase label; what follows is the name,
           * and it gets the serif. Reading top to bottom you get the qualifier
           * before the thing, which is the order the archetype is built in.
           *
           * Both halves are `paper`. The label sat at `ash` when it was one
           * more field on the card, but the archetype is a single title read as
           * a unit, and two tones split it into a caption and a headline. Face,
           * size and tracking already separate the halves; colour would only be
           * saying it a fourth time, and dimmer. */}
          {title.first && (
            <div className="mt-3.5 text-center">
              {title.rest && (
                <span className="block text-[13px] uppercase leading-[1.1] tracking-[0.2em] text-paper">
                  {title.first}
                </span>
              )}
              <span className={title.rest ? "mt-[5px] block" : "block"}>{name}</span>
            </div>
          )}

          <div className="mt-[9px] flex items-baseline justify-center gap-[7px] text-[9px] uppercase tracking-[0.16em] text-card-2">
            <span>Taste class</span>
            {variant.name && (
              <span className="display" style={{ color: variant.accentColor }}>
                {variant.name}
              </span>
            )}
          </div>

          {/* The score leads, and the rule that used to sit above it is gone.
           *
           * That hairline was doing a job: it made the figure read as its own
           * statement rather than as a footnote to the archetype. Structure
           * does the same job better here, so nothing is lost by dropping it.
           * The number takes the card's lead step and the stars and tier
           * demote beneath it, which separates the statement by hierarchy
           * instead of by drawing a line across the card to say so. */}
          {data.mean !== null && (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <span className={`num text-[30px] leading-none ${ratingColor(data.mean)}`}>
                {formatTenths(data.mean)}
              </span>
              <span className="flex items-baseline gap-2">
                <Stars mean={data.mean} />
                <span
                  className="text-[9px] uppercase tracking-[0.1em]"
                  style={{ color: tier.labelColor }}
                >
                  {tier.name}
                </span>
              </span>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-3.5 flex flex-col gap-2">
              {/* Themes, as proportion rather than as text.
               *
               * These were pills, which put the share inside a bubble and made
               * 24% and 18% the same size on the card: the one thing the figure
               * is for, comparison, was the one thing the shape refused to do.
               * The band spends its width the way the shelf is spent, so the
               * lead theme is visibly the lead theme before a number is read.
               *
               * `flexGrow` carries the share directly, so the segments stay
               * proportional without normalising three percentages that do not
               * add to a hundred. Three steps of `paper` and no hue: the stock
               * underneath is the only colour on this card. */}
              <span aria-hidden className="flex h-[3px] w-full overflow-hidden rounded-[2px]">
                {chips.map((g, i) => (
                  <i
                    key={g.name}
                    className={["bg-paper/55", "bg-paper/35", "bg-paper/20"][i] ?? "bg-paper/20"}
                    style={{ flexGrow: g.pct }}
                  />
                ))}
              </span>
              <span className="flex justify-between gap-2">
                {chips.map((g) => (
                  <span
                    key={g.name}
                    className="text-[9px] uppercase tracking-[0.1em] text-card-2"
                  >
                    {g.name} <b className="num font-normal text-card-3">{g.pct}%</b>
                  </span>
                ))}
              </span>
            </div>
          )}

          {data.signatureFilms.length > 0 && (
            <div className="mt-3.5 grid grid-cols-4 gap-1">
              {data.signatureFilms.map((f) => {
                const poster = posterUrl(f.posterPath, "w154");
                return (
                  <div
                    key={f.slug}
                    className="relative overflow-hidden rounded-[4px] border border-seam bg-tray"
                    style={{ aspectRatio: "2/3" }}
                  >
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center p-1 text-center text-[8px] text-card-2">
                        {f.title}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.traitsHeldCount > 0 && (
            <div className="mt-3 flex items-center justify-center gap-2.5 text-[10px]">
              <span className="num text-gold">{data.traitsHeldCount} traits</span>
              {/* The split, once there is one: what share of the works on this
                  shelf are series rather than films. Gated on the series count
                  rather than the season count, so somebody who rates shows
                  whole and never by season still gets the figure. */}
              {data.mix.shows > 0 && (
                <span className="num text-card-3">{data.mix.showShare}% series</span>
              )}
            </div>
          )}
        </div>
      </div>
  );
}
