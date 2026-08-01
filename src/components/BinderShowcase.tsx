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
  yours: "Yours",
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
          Your title is two readings joined: the era you watch most, and the genre that leads
          your ratings. You never pick it, and it is re-read every time your taste moves: rate
          enough of something else and it becomes a different title.
        </p>
      </div>

      {a === null ? (
        <p className="mt-7 border-y border-seam py-5 text-[15px] text-paper">
          Not named yet. Rate {binder.toArchetype} more{" "}
          {binder.toArchetype === 1 ? "film" : "films"} and your title is read for the first time.
        </p>
      ) : (
        <div className="mt-7 border-y border-seam py-6">
          <div className="display text-[30px] leading-none text-paper">{a.name}</div>
          <p className="display mt-3 max-w-[46ch] text-[15px] leading-snug text-beam">
            &ldquo;{a.quote}&rdquo;
          </p>

          <dl className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="display text-[15px] text-paper">{a.era}</dt>
              <dd className="mt-1 max-w-[34ch] text-sm leading-relaxed text-ash">
                {a.eraMeaning}
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
          How you rate, rather than what you watch. The bar below is your whole profile: the
          percentages are shares of it and add up to 100, so they say which readings are
          strongest relative to each other. The count under each one is that reading on its own
          terms, and can be checked against your library. Only the readings your library
          actually produced are here; more appear as you rate more, and none of them is a
          target.
        </p>
      </div>

      {/* The whole profile as one bar, filled exactly once. The shares sum to
          100 by construction, so this is the claim drawn rather than asserted:
          the segments run in the same order as the list beneath it. */}
      <div
        className="mt-8 flex h-2.5 w-full overflow-hidden rounded-full bg-[#1f1f25]"
        role="img"
        aria-label={`Your profile: ${rows.map((r) => `${r.label} ${r.pct}%`).join(", ")}.`}
      >
        {rows.map((row, i) => (
          <span
            key={row.label}
            className="h-full bg-beam"
            style={{
              width: `${row.pct}%`,
              opacity: segmentOpacity(i, rows.length),
              boxShadow: i === rows.length - 1 ? undefined : "inset -1px 0 0 #141417",
            }}
          />
        ))}
      </div>

      <dl className="mt-8 border-b border-seam">
        {rows.map((row, i) => (
          <div key={row.label} className="relative py-4">
            <span
              aria-hidden
              className="plate-rule absolute inset-x-0 top-0 h-px bg-seam"
              style={{ animationDelay: `${i * 40}ms` }}
            />
            <div className="flex items-baseline gap-3">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-beam"
                style={{ opacity: segmentOpacity(i, rows.length) }}
              />
              <dt className="display flex-1 text-[17px] leading-tight text-paper">{row.label}</dt>
              <dd className="num shrink-0 text-[17px] leading-tight text-beam">{row.pct}%</dd>
            </div>
            <dd className="mt-1.5 max-w-[62ch] pl-5 text-sm leading-relaxed text-ash">
              {row.meaning}{" "}
              <span className="num text-dim">
                {row.basis}, or {row.rawPct}%.
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function BinderShowcase({ binder }: { binder: Binder }) {
  return (
    <div>
      <ArchetypeSection binder={binder} />
      <PersonalitySection rows={binder.personality} />

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
            below yours is one you came through.
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
                        ? "Issued with the first film you rate."
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
            Six stocks: the ground your card is printed on. Stock reads the genre leading your
            rated films, so it is never chosen and it moves when your taste does. Rate enough of
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
                note: "The decade you rate highest, once at least three films sit in it. Not the decade you watch most.",
                rows: binder.accents,
              },
              { title: "Aura", note: "Your average, read as a whole.", rows: binder.auras },
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
