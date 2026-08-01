"use client";

import { TasteCardBackBig, TasteCardFrontBig } from "./TasteCardBig";
import type { HomeTasteCardData } from "@/lib/taste";
import FoilLight, { CARD_FOIL } from "./FoilLight";
import { stockDef } from "@/lib/taste-card";

/**
 * The full-detail card, front and back, as a real 3D flip — used inside the
 * expanded popup. `flipped`/`onFlip` are controlled so the dialog's "Flip ⇄"
 * button and clicking the card itself stay in sync.
 *
 * Front and back are stacked in the same CSS grid cell rather than pinned to
 * a fixed aspect-ratio box: whichever face has more content (traits held,
 * genres tagged, a long archetype name) sets the height, so nothing is ever
 * clipped by a box that assumed a shorter card.
 */
export default function TasteCardFlip({
  data,
  username,
  displayName,
  avatarUrl,
  memberNumber,
  flipped,
  onFlip,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number;
  flipped: boolean;
  onFlip: () => void;
}) {
  const border = data.tier.border;
  const stock = stockDef(data.variant.stock);
  const glow = data.tier.glow;

  return (
    <div className="mx-auto w-full max-w-[320px]" style={{ perspective: "1600px" }}>
      <button
        type="button"
        onClick={onFlip}
        aria-label={flipped ? "Show card front" : "Show card back"}
        className="relative grid w-full cursor-pointer text-left"
        style={{
          transformStyle: "preserve-3d",
          transition: "transform .8s cubic-bezier(.2,.75,.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* front */}
        <div
          className="col-start-1 row-start-1 min-h-full rounded-[18px] p-[1.5px]"
          style={{
            background: border,
            boxShadow: `${glow === "none" ? "" : glow + ", "}0 30px 70px rgba(0,0,0,.6)`,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            visibility: flipped ? "hidden" : "visible",
            opacity: flipped ? 0 : 1,
            transition: "opacity .14s linear .32s, visibility 0s linear .38s",
          }}
        >
          <div
            className="relative h-full overflow-hidden rounded-[17px]"
            style={{ background: stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)" }}
          >
            {stock?.texture && (
              <span aria-hidden className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
            )}
            <FoilLight intensity={data.tier.sheenOp * CARD_FOIL} sweepSec={data.tier.sweepSec} />
            <TasteCardFrontBig data={data} username={username} displayName={displayName} avatarUrl={avatarUrl} memberNumber={memberNumber} />
          </div>
        </div>

        {/* back */}
        <div
          className="col-start-1 row-start-1 min-h-full rounded-[18px] p-[1.5px]"
          style={{
            background: border,
            boxShadow: "0 30px 70px rgba(0,0,0,.6)",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            visibility: flipped ? "visible" : "hidden",
            opacity: flipped ? 1 : 0,
            transition: "opacity .14s linear .32s, visibility 0s linear .38s",
          }}
        >
          <div
            className="relative h-full overflow-hidden rounded-[17px]"
            style={{ background: stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)" }}
          >
            {stock?.texture && (
              <span aria-hidden className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
            )}
            {/* the back is the same piece of card stock, so it carries the same
                stock and foil; a card finished on one side only reads as a
                print, not an object */}
            <FoilLight intensity={data.tier.sheenOp * CARD_FOIL} sweepSec={data.tier.sweepSec} />
            <TasteCardBackBig data={data} username={username} displayName={displayName} />
          </div>
        </div>
      </button>
    </div>
  );
}
