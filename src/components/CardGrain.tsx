/**
 * How much of the printed finish a card with type on it actually wears.
 *
 * The binder's specimens are bare, so they take the grain at full strength and
 * are the honest reference for what a tier looks like. A real card has an
 * archetype, a rating and four posters sitting over the same surface, and the
 * dither competes with small text long before it competes with anything else.
 */
export const CARD_GRAIN = 0.55;

/**
 * The tier's finish: a banded highlight printed through an ordered dither.
 *
 * Sits between the stock's ground and the foil's drifting light, and rides the
 * same `sheenOp` curve every other tier effect uses — nothing at Common, a
 * pressed metallic grain by Mythic. One rule, no new gate.
 *
 * Static by design. The foil already owns the card's continuous motion, and a
 * second thing breathing underneath it would be noise; this is the material
 * the light falls on, not another light. It costs one painted element, which
 * is why the binder can afford twelve of them.
 *
 * No hooks and no client boundary, so it drops into server and client
 * components alike — same contract as `FoilLight`.
 */
export default function CardGrain({
  /** 0–1, the tier's own `sheenOp`; nothing renders at 0 */
  intensity,
  /**
   * Multiplier on the printed strength. The full-size card carries type over
   * the grain, so it wears less than a bare specimen does.
   */
  strength = 1,
}: {
  intensity: number;
  strength?: number;
}) {
  if (intensity <= 0) return null;

  return (
    <span
      aria-hidden
      className="card-grain"
      style={{ "--grain-op": intensity * strength } as React.CSSProperties}
    />
  );
}
