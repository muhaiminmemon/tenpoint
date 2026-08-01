import FoilLight, { CARD_FOIL } from "./FoilLight";
import CardGrain, { CARD_GRAIN } from "./CardGrain";
import { RARITY_TIERS, stockDef } from "@/lib/taste-card";
import { posterUrl } from "@/lib/tmdb-urls";

/**
 * A taste card with nobody on it, for the signed-out landing.
 *
 * The card is the most distinctive thing the product makes and no visitor can
 * see one before signing up, so the landing shows the object itself. What it
 * must not do is imply a member: there is no handle, no member number, no
 * joined year and no rating, because the project has no users yet and an
 * invented one would be fabricated proof rather than an illustration.
 *
 * What remains is true of the mechanism regardless of whose card it is — the
 * tier's rim and foil, the stock's ground, and the fact that an archetype is
 * read rather than chosen. The film slots take real posters from the same wall
 * the rest of the page draws on.
 *
 * A server component. The foil is CSS, so this ships no JavaScript.
 */
export default function SpecimenCard({
  posterPaths,
  className = "",
}: {
  posterPaths: string[];
  className?: string;
}) {
  // Legendary rather than the top tier: it carries obvious foil without
  // implying the card arrives finished.
  const tier = RARITY_TIERS.find((t) => t.name === "Legendary") ?? RARITY_TIERS[0];
  const stock = stockDef("Nebula");
  const slots = posterPaths.slice(0, 4);

  return (
    <div
      className={`w-[210px] rounded-[20px] p-px sm:w-[248px] ${className}`}
      style={{ background: tier.border, boxShadow: tier.glow === "none" ? undefined : tier.glow }}
    >
      <div
        className="relative overflow-hidden rounded-[19px]"
        style={{ background: stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)" }}
      >
        {stock?.texture && (
          <span aria-hidden className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
        )}
        <CardGrain intensity={tier.sheenOp} strength={CARD_GRAIN} />
        <FoilLight intensity={tier.sheenOp * CARD_FOIL} sweepSec={tier.sweepSec} />

        <div className="relative p-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-ash">Taste class</span>
            <span
              className="display text-[9px] uppercase tracking-[.08em]"
              style={{ color: tier.labelColor }}
            >
              {tier.name}
            </span>
          </div>

          <p className="display mt-2 text-[21px] leading-[1.05] text-paper">
            The Midnight
            <br />
            Maximalist
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-ash">
            Read from what you rate. Never chosen.
          </p>

          {slots.length > 0 && (
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {slots.map((path, i) => {
                const url = posterUrl(path, "w154");
                return (
                  <span
                    key={i}
                    className="relative block overflow-hidden rounded-[5px] border border-seam bg-tray"
                    style={{ aspectRatio: "2/3" }}
                  >
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
