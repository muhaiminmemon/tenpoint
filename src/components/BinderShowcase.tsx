import type { AxisRow, Binder, FinishState, PersonalityRow, TierRow } from "@/lib/binder";
import type { StockDef } from "@/lib/taste-card";
import FoilLight from "./FoilLight";
import CardGrain from "./CardGrain";

/**
 * Every finish the card can be dealt, and which of them are yours.
 *
 * A server component with no interaction of any kind — nothing here opens,
 * expands, or can be configured, so nothing here ships JavaScript. The whole
 * page is one read.
 *
 * One rule carries the design: a finish you don't have is drawn in full behind
 * a glassine veil, so the material stays readable and it is the light and
 * motion that are withheld, never the label. Tiers and variants are set as the
 * same kind of list because they are the same kind of fact — a finish, its
 * condition, and whether it is yours — and a reader should not have to learn
 * two layouts to read one page.
 */

const STATE_LABEL: Record<FinishState, string> = {
  yours: "Held now",
  held: "Held",
  unheld: "Not held",
};

/** The tissue a finish you don't hold is seen through. */
function Glassine() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage:
          "repeating-linear-gradient(64deg,rgba(236,234,230,.05) 0 2px,transparent 2px 5px),linear-gradient(158deg,rgba(14,14,16,.66),rgba(14,14,16,.5))",
      }}
    />
  );
}

function TierSpecimen({ tier, held }: { tier: TierRow["tier"]; held: boolean }) {
  return (
    <span
      className="relative block h-[62px] w-[46px] shrink-0 overflow-hidden rounded-[4px] p-px"
      style={{ background: tier.border, boxShadow: held && tier.glow !== "none" ? tier.glow : undefined }}
      aria-hidden
    >
      <span className="relative block size-full overflow-hidden rounded-[3px] bg-[linear-gradient(158deg,#18181e,#0f0f13)]">
        {/* A finish you hold catches the light. One you don't is the same foil,
            standing still — held back, not hidden. */}
        <CardGrain intensity={tier.sheenOp} />
        <FoilLight intensity={tier.sheenOp} sweepSec={tier.sweepSec} still={!held} blurPx={4} />
        {!held && <Glassine />}
      </span>
    </span>
  );
}

function VariantSpecimen({ stock, held }: { stock: StockDef; held: boolean }) {
  return (
    <span
      className="relative block h-[62px] w-[46px] shrink-0 overflow-hidden rounded-[4px] bg-seam p-px"
      aria-hidden
    >
      <span
        className="relative block size-full overflow-hidden rounded-[3px]"
        style={{ background: stock.material }}
      >
        {stock.texture && (
          <span className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
        )}
        {/* Slower than the card's own light: these are specimens in a case,
            not the card in your hand. */}
        <FoilLight intensity={0.5} sweepSec={60} still={!held} blurPx={4} />
        {!held && <Glassine />}
      </span>
    </span>
  );
}

/** The mark on a finish that is yours or was. Never a badge, never a count. */
function StateMark({ state }: { state: FinishState }) {
  if (state === "unheld") return <span className="sr-only">Not held</span>;
  return (
    <span
      className={`display text-2xs uppercase tracking-[0.12em] ${
        state === "yours" ? "text-gold" : "text-beam"
      }`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

/**
 * What the reader's own title means, and only theirs.
 *
 * The rest of the binder lists every finish that exists because a finish is
 * something you can hold. An archetype isn't: it is what the library currently
 * says about the person reading it, so the ones they don't have would just be
 * descriptions of other people. When their taste moves the title is re-read and
 * this section explains the new one instead.
 */
function ArchetypeSection({ binder }: { binder: Binder }) {
  const a = binder.archetype;

  return (
    <section aria-labelledby="archetype" className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <div className="mt-5 max-w-[58ch]">
        <h2 id="archetype" className="display text-[26px] leading-none text-paper">
          Archetype
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          Your title is two readings joined. The second word is the thing your films keep
          returning to, found by theme rather than genre: not &ldquo;Thriller&rdquo; but the
          heists, the time loops, the houses that will not let go. It is weighed against how
          common that theme is, so it names what you watch unusually much of rather than what
          everyone watches. The first word is how you watch: whichever measure your library sits
          furthest from ordinary on, including several that read your opinions rather than your
          shelf, which is what separates two people who have seen all the same films. You never
          pick either, and both are re-read every time your taste moves.
        </p>
      </div>

      {a === null ? (
        <p className="mt-7 border-y border-seam py-5 text-[15px] text-paper">
          Not named yet. Rate {binder.toArchetype} more{" "}
          {binder.toArchetype === 1 ? "film" : "films"} and your title is read for the first time.
        </p>
      ) : (
        <div className="mt-7 border-y border-seam py-6">
          <div className="display text-[30px] leading-none text-paper">{a.title}</div>
          {a.nearMiss && (
            <p className="mt-2 text-[13px] text-dim">{a.nearMiss}</p>
          )}

          <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="display text-[15px] text-paper">{a.modifier}</dt>
              <dd className="mt-1 max-w-[34ch] text-sm leading-relaxed text-ash">
                {a.modifierMeaning}
              </dd>
            </div>
            <div>
              <dt className="display text-[15px] text-paper">{a.noun}</dt>
              <dd className="mt-1 max-w-[34ch] text-sm leading-relaxed text-ash">
                {a.nounMeaning}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}

/**
 * The readings this library produced, and the arithmetic behind each one.
 *
 * The card has room for a label, a number and a bar; this is where the rule
 * that produced the number is written down. Every one is a share of a stated
 * denominator, so a reader who doubts a figure can count it out of their own
 * library.
 *
 * The one section of the binder with no unheld state, and deliberately: the
 * rest of the page prints the finishes you don't have because a finish is
 * something you could hold, but a reading is a description. Listing the ones
 * that aren't true of you would be a list of other people, and naming them
 * would turn a description into a set of things to go and earn.
 */
/**
 * Segments step down in weight from the largest reading to the smallest, which
 * is also the order the list below runs in. One ramp does the work a legend
 * would otherwise need a colour scale for, and the profile stays monochrome.
 */
function segmentOpacity(i: number, total: number) {
  return total <= 1 ? 1 : 1 - (i / (total - 1)) * 0.62;
}

/** What the five stars beside the rating actually are. */
const STAR_BANDS = [
  { stars: 5, range: "9.0 and up" },
  { stars: 4, range: "7.0 to 8.9" },
  { stars: 3, range: "5.0 to 6.9" },
  { stars: 2, range: "3.0 to 4.9" },
  { stars: 1, range: "under 3.0" },
];

function StarsSection() {
  return (
    <section aria-labelledby="stars" className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <div className="mt-5 max-w-[58ch]">
        <h2 id="stars" className="display text-[26px] leading-none text-paper">
          The stars
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          The five stars beside the number on your card are that same number, rounded to a
          five-point scale. They are not a second rating, they count nothing on their own, and
          nothing you do moves them except your average moving. They are there because a shape
          reads across a room and a decimal does not.
        </p>
      </div>

      <dl className="mt-7 border-y border-seam">
        {STAR_BANDS.map((b, i) => (
          <div
            key={b.stars}
            className={`flex items-center gap-4 py-3 ${i === 0 ? "" : "border-t border-seam"}`}
          >
            <dt className="num w-[74px] shrink-0 text-[13px] tracking-[0.1em] text-gold">
              {"\u2605".repeat(b.stars)}
              <span className="text-seam">{"\u2605".repeat(5 - b.stars)}</span>
            </dt>
            <dd className="text-[14px] text-paper">Average {b.range}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PersonalitySection({ rows }: { rows: PersonalityRow[] }) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="personality" className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <div className="mt-5 max-w-[58ch]">
        <h2 id="personality" className="display text-[26px] leading-none text-paper">
          Personality
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          Four ways of cutting the same library. Every film lands in exactly one band of each
          bar, so each bar adds to 100 and every figure is a plain count you can check. Nothing
          here is a target, and an axis only appears once enough of your library carries what it
          needs.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-9">
        {rows.map((axis) => (
          <div key={axis.key}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="display text-[17px] leading-tight text-paper">{axis.title}</h3>
              <span className="num shrink-0 text-[11px] text-dim">{axis.basis}</span>
            </div>

            {/* The axis drawn rather than asserted: one bar, filled exactly
                once, in the same order as the list under it. */}
            <div
              className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[#1f1f25]"
              role="img"
              aria-label={`${axis.title}: ${axis.bands
                .map((b) => `${b.label} ${b.pct}%`)
                .join(", ")}.`}
            >
              {axis.bands.map((band, i) => (
                <span
                  key={band.label}
                  className="h-full bg-beam"
                  style={{
                    width: `${band.pct}%`,
                    opacity: segmentOpacity(i, axis.bands.length),
                    boxShadow: i === axis.bands.length - 1 ? undefined : "inset -1px 0 0 #141417",
                  }}
                />
              ))}
            </div>

            <dl className="mt-3">
              {axis.bands.map((band, i) => (
                <div
                  key={band.label}
                  className="flex items-baseline gap-3 border-t border-seam py-2 first:border-t-0"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full bg-beam"
                    style={{ opacity: segmentOpacity(i, axis.bands.length) }}
                  />
                  <dt className="flex-1 text-[13.5px] text-paper">{band.label}</dt>
                  <dd className="num shrink-0 text-[13.5px] text-dim">{band.count}</dd>
                  <dd className="num w-12 shrink-0 text-right text-[15px] text-beam">
                    {band.pct}%
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-ash">
              {axis.note}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function BinderShowcase({
  binder,
  /**
   * Whose binder this is, when it is not the reader's own.
   *
   * A friend's binder drops the Archetype and Personality sections rather than
   * rewording them. Both are readings *of a person* rather than finishes they
   * hold, their sentences are generated in the data layer in the second
   * person, and the profile that linked here already shows the archetype on
   * the card. What remains is the catalogue, which is the part worth visiting.
   */
  person,
}: {
  binder: Binder;
  person?: string;
}) {
  const theirs = person !== undefined;
  return (
    <div>
      {!theirs && <ArchetypeSection binder={binder} />}
      <StarsSection />
      {!theirs && <PersonalitySection rows={binder.personality} />}

      {/* ---------------------------------------------------------------- tiers */}
      <section aria-labelledby="tiers" className="scroll-mt-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
          <span aria-hidden className="h-px flex-1 bg-seam" />
        </div>
        <div className="mt-5 max-w-[58ch]">
          <h2 id="tiers" className="display text-[26px] leading-none text-paper">
            Tiers
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ash">
            Six finishes, in order. Each one is issued at a count of rated films, so every tier
            below the current one was genuinely passed through.
          </p>
        </div>

        <ol className="mt-7 border-b border-seam">
          {binder.tiers.map((row, i) => {
            const held = row.state !== "unheld";
            return (
              <li key={row.tier.name} className="relative">
                <span
                  aria-hidden
                  className="plate-rule absolute inset-x-0 top-0 h-px bg-seam"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
                <div className="flex items-center gap-4 py-4 sm:gap-5">
                  <TierSpecimen tier={row.tier} held={held} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="display text-[17px] leading-tight text-paper">
                        {row.tier.name}
                      </span>
                      <span className="num text-2xs tracking-[0.08em] text-ash">
                        {row.tier.range}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ash">
                      {row.tier.index === 0
                        ? "Issued with the first film rated."
                        : `Issued at ${row.tier.floor} films rated.`}{" "}
                      {row.tier.effect}
                    </p>
                  </div>
                  <StateMark state={row.state} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ------------------------------------------------------------- variants */}
      <section aria-labelledby="variants" className="mt-16 scroll-mt-6">
        <div className="flex items-center gap-3">
          <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
          <span aria-hidden className="h-px flex-1 bg-seam" />
        </div>
        <div className="mt-5 max-w-[58ch]">
          <h2 id="variants" className="display text-[26px] leading-none text-paper">
            Variants
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ash">
            Six stocks: the ground the card is printed on. Stock reads the genre leading the
            rated films, so it is never chosen and it moves when taste does. Rate enough of
            something else and the card is dealt on different stock.
          </p>
        </div>

        <ol className="mt-7 border-b border-seam">
          {binder.variants.map((row, i) => {
            const held = row.state !== "unheld";
            return (
              <li key={row.name} className="relative">
                <span
                  aria-hidden
                  className="plate-rule absolute inset-x-0 top-0 h-px bg-seam"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
                <div className="flex items-center gap-4 py-4 sm:gap-5">
                  <VariantSpecimen stock={row.stock} held={held} />
                  <div className="min-w-0 flex-1">
                    <span className="display text-[17px] leading-tight text-paper">
                      {row.name}
                    </span>
                    <p className="mt-1 max-w-[46ch] text-sm text-ash">{row.stock.condition}</p>
                  </div>
                  <StateMark state={row.state} />
                </div>
              </li>
            );
          })}
        </ol>

        {/* the other two axes of the same finish */}
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          {(
            [
              {
                title: "Accent",
                note: "The decade rated highest, once at least three films sit in it. Not the decade watched most.",
                rows: binder.accents,
              },
              { title: "Aura", note: "The average, read as a whole.", rows: binder.auras },
            ] as { title: string; note: string; rows: AxisRow[] }[]
          ).map((group) => (
            <div key={group.title}>
              <h3 className="display text-[15px] text-paper">{group.title}</h3>
              <p className="mt-1 text-sm text-ash">{group.note}</p>
              <ul className="mt-3 space-y-px">
                {group.rows.map(({ axis, yours }) => (
                  <li
                    key={axis.name}
                    className={`flex items-baseline gap-2.5 rounded-[4px] px-2.5 py-2 ${
                      yours ? "bg-tray/60" : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: axis.color, opacity: yours ? 1 : 0.4 }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`display text-[13px] ${yours ? "text-paper" : "text-ash"}`}>
                        {axis.name}
                      </span>
                      <span className="mt-0.5 block text-2xs leading-relaxed text-ash">
                        {axis.condition}
                      </span>
                    </span>
                    {yours && (
                      <span className="display shrink-0 text-2xs uppercase tracking-[0.12em] text-gold">
                        Yours
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
