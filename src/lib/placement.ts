/**
 * The rating a gap in the ranked library is worth.
 *
 * Read off the titles either side of it — two above and two below — because
 * those four are what the gap actually means: better than these, worse than
 * those. The average of them, rounded to a tenth.
 *
 * Integer arithmetic end to end. Ratings are tenths in a `smallint` and must
 * never pass through floating-point before display, so this rounds to a whole
 * tenth and hands back a number already on the scale.
 */

/** How many neighbours on each side of a gap are read. */
export const WINDOW = 2;

/**
 * The ranked list either side of one gap.
 *
 * `above` is nearest-first going up, `below` nearest-first going down; both are
 * short at the ends of the list, where there simply is less to be relative to.
 */
export function ratingFromNeighbours(above: number[], below: number[]): number | null {
  const seen = [...above.slice(0, WINDOW), ...below.slice(0, WINDOW)];
  if (seen.length === 0) return null;
  const total = seen.reduce((sum, r) => sum + r, 0);
  return Math.round(total / seen.length);
}

/**
 * Where a row sits among others carrying the same rating.
 *
 * `sort_key` is `double precision` so dropping something between two titles is
 * one write rather than a renumbering of everything below it — the same trick
 * `watchlist.position` uses. It is only needed when the derived rating matches
 * a neighbour: a rating nobody else holds sorts itself.
 */
export function sortKeyBetween(above: number | null, below: number | null): number {
  if (above === null && below === null) return 0;
  if (above === null) return below! - 1;
  if (below === null) return above + 1;
  return (above + below) / 2;
}

/**
 * True when the two keys are too close to fit a number between them.
 *
 * Covers both the band nobody has ever ordered, where every key is still the
 * column default of zero, and the band where repeated dropping at one point has
 * finally exhausted the mantissa. Either way the fix is the same: number the
 * band as it stands, once, and every insert after that is a single write again.
 */
export function needsRenumber(above: number | null, below: number | null): boolean {
  if (above === null || below === null) return false;
  return below - above < 1e-6;
}
