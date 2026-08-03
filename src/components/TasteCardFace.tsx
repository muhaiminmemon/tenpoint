import FoilLight, { CARD_FOIL } from "./FoilLight";
import CardGrain, { CARD_GRAIN } from "./CardGrain";
import { accentFor, formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { stockDef } from "@/lib/taste-card";
import type { HomeTasteCardData } from "@/lib/taste";

function Stars({ mean }: { mean: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(mean / 20)));
  return (
    <span className="num text-[10px] tracking-[0.1em] text-gold">
      {"\u2605".repeat(filled)}
      <span className="text-seam">{"\u2605".repeat(5 - filled)}</span>
    </span>
  );
}

/**
 * The card itself: rim, ground, finish and everything printed on the front.
 *
 * Extracted so the homepage and a profile show the same object rather than two
 * near-copies that drift. Only the chrome around it differs \u2014 home wraps it in
 * share and view actions, a profile does not \u2014 and nothing in here knows or
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

  // Two materials, one per axis the card actually has. The rim is the tier,
  // because rarity should stay the loudest signal; the ground is the stock.
  // Nothing decorative sits between them — a third material with no axis
  // behind it would be a finish the binder can't explain.
  return (
      <div
        className="relative overflow-hidden rounded-[19px]"
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

        <div className="relative p-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="size-7 rounded-full object-cover" />
              ) : (
                <span className="display flex size-7 items-center justify-center rounded-full bg-tray text-xs text-paper">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <div className="display text-[13px] text-beam">@{username}</div>
                <div className="num text-[9px] uppercase tracking-[0.14em] text-dim">Since {memberSince}</div>
              </div>
            </div>
            {data.mean !== null && (
              <div className="text-right">
                <div className={`num text-[26px] leading-none ${ratingColor(data.mean)}`}>
                  {formatTenths(data.mean)}
                </div>
                <div className="mt-1">
                  <Stars mean={data.mean} />
                  <span
                    className="ml-1.5 text-[9px] uppercase tracking-[0.1em]"
                    style={{ color: tier.labelColor }}
                  >
                    {tier.name}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ash">Taste class</div>
              {variant.name && (
                <div className="display text-[9px] uppercase tracking-[.08em]" style={{ color: variant.accentColor }}>
                  {variant.name}
                </div>
              )}
            </div>
            {/* Centred, because the title is the one line on the card that is
                a name rather than a field. Left-aligned it wrapped ragged
                under a row already split to both edges; centred it reads as
                the plate the rest of the card is pretending to be. */}
            <div className="display mt-1 text-center text-[20px] leading-[1.05] text-paper">
              {data.archetype}
            </div>
          </div>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              {/* Themes, with their share. Genre tags put Adventure and Action
                  on almost every card; a theme is what the library keeps
                  returning to, and it is the same reading the title, the stock
                  and the DNA strip all run on. The number is the true share of
                  the shelf, the same figure the binder prints. */}
              {chips.map((g) => (
                <span
                  key={g.name}
                  className="inline-flex items-center gap-2 rounded-full border border-seam bg-[rgba(255,255,255,.04)] px-2.5 py-1 text-[11px] text-paper"
                >
                  {g.name}
                  <span className="num text-[10px] text-ash">{g.pct}%</span>
                </span>
              ))}
            </div>
          )}

          {data.signatureFilms.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {data.signatureFilms.map((f) => {
                const poster = posterUrl(f.posterPath, "w154");
                return (
                  <div
                    key={f.slug}
                    className="relative overflow-hidden rounded-[5px] border border-seam bg-tray"
                    style={{ aspectRatio: "2/3" }}
                  >
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center p-1 text-center text-[8px] text-ash">
                        {f.title}
                      </span>
                    )}
                    <span
                      className="absolute left-1 top-1 h-3.5 w-[3px] rounded-[2px]"
                      style={{ background: accentFor(f.slug) }}
                      aria-hidden
                    />
                  </div>
                );
              })}
            </div>
          )}

          {data.traitsHeldCount > 0 && (
            <div className="mt-4 flex items-center justify-center gap-2.5 border-t border-seam pt-3">
              <span className="num text-[10px] text-gold">{data.traitsHeldCount} traits</span>
            </div>
          )}
        </div>
      </div>
  );
}
