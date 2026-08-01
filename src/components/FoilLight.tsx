/**
 * How much of a tier's nominal sheen the full-size card actually wears.
 *
 * `sheenOp` was tuned for a single narrow band. The aurora covers the whole
 * surface, so at full strength it competes with the type sitting on top of it;
 * a card should look like it has a finish, not like it is behind weather. The
 * binder's specimens carry no text and are the point of that page, so they are
 * left at full strength.
 *
 * The first pass at that was a tenth, which overcorrected: it put the top tier
 * at 0.07 opacity, where the stock's ground beat the foil outright and the
 * card read as coloured card rather than as finished card. The shine is the
 * part worth looking at, so it leads and the stock sits under it. Kept well
 * below the raw `sheenOp` because the mask concentrates the glint in the
 * top-right corner, which is exactly where the rating and tier label sit.
 */
export const CARD_FOIL = 0.3;

/**
 * The holographic foil on a taste card.
 *
 * Built on the aurora technique (adapted from 21st.dev's Aurora Background):
 * a stripe gradient and a colour ramp stacked and blurred, then duplicated
 * onto a travelling layer that blends by difference against the static one.
 * The iridescence comes from the two layers disagreeing, so it shifts and
 * folds rather than sliding past. The CSS lives in `globals.css` under
 * `.foil`; both layers are pseudo-elements, so this renders one node.
 *
 * No hooks and no client boundary, so it drops into server and client
 * components alike.
 */
export default function FoilLight({
  /** 0–1, from the tier's own `sheenOp`; nothing renders at 0 */
  intensity,
  /** seconds for one full aurora cycle */
  sweepSec = 48,
  /** render the foil without moving it — a finish on display, not in hand */
  still = false,
  /**
   * Blur radius. The default suits a full card; a small specimen needs less or
   * the whole tile turns to haze rather than reading as a finish.
   */
  blurPx = 10,
}: {
  intensity: number;
  sweepSec?: number;
  still?: boolean;
  blurPx?: number;
}) {
  if (intensity <= 0) return null;

  // The lower tiers carry foil that does not travel, recorded as a zero cycle.
  // Emitting `animation: 0s` would be a malformed duration, so a zero reads as
  // "still" and the duration falls back to something valid but unused.
  const frozen = still || sweepSec <= 0;

  return (
    <span
      aria-hidden
      className={`foil${frozen ? " foil-still" : ""}`}
      style={
        {
          "--foil-op": intensity,
          "--sweep": `${sweepSec > 0 ? sweepSec : 48}s`,
          "--foil-blur": `${blurPx}px`,
        } as React.CSSProperties
      }
    />
  );
}
