import Link from "next/link";
import type { AxisRow, Binder, FinishState, PersonalityRow, TierRow } from "@/lib/binder";

import { inThirdPerson } from "@/lib/voice";


import { posterUrl } from "@/lib/tmdb-urls";
import { formatTenths, ratingColor } from "@/lib/format";
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

/**
 * How far off a finish is, in one shape wherever it appears.
 *
 * Set apart from the condition rather than run into it: the condition is the
 * rule, which never changes, and this is the reader's position against it,
 * which changes every time they log something. Reading as one sentence made
 * the fixed half look personal.
 */
function Distance({ text }: { text: string | null }) {
  if (!text) return null;
  return <span className="mt-1 block text-2xs leading-relaxed text-dim">{text}</span>;
}

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
      className={`relative block h-[62px] w-[46px] shrink-0 overflow-hidden p-px ${
        held ? (tier.rimClass ?? "") : ""
      }`}
      style={{ background: tier.border, boxShadow: held && tier.glow !== "none" ? tier.glow : undefined }}
      aria-hidden
    >
      <span className="relative block size-full overflow-hidden bg-[linear-gradient(158deg,#18181e,#0f0f13)]">
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
      className="relative block h-[62px] w-[46px] shrink-0 overflow-hidden bg-seam p-px"
      aria-hidden
    >
      <span
        className="relative block size-full overflow-hidden"
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
function StateMark({
  state,
  markPast = true,
}: {
  state: FinishState;
  /**
   * Whether a finish held earlier still prints its own mark.
   *
   * The tier list turns this off. A rank you have passed through is already
   * legible there without a word for it: the specimen beside it still catches
   * the light, where one never held stands still, and the rung you hold now
   * says so in gold. Printing "Held" down the rest of the ladder marked almost
   * every row and left the one that matters competing with its own history.
   */
  markPast?: boolean;
}) {
  if (state === "unheld") return <span className="sr-only">Not held</span>;
  // Announced but not drawn, the same way an unheld finish is.
  if (state === "held" && !markPast) return <span className="sr-only">Held before</span>;
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
function ArchetypeSection({ binder, person }: { binder: Binder; person?: string }) {
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
        {/* One sentence per idea, and each one assembled whole.
         *
         * This was a single hundred-word chain with pronouns interpolated at
         * eleven points mid-sentence, which is both hard to read and the exact
         * shape that once shipped "what youkeep returning to": a `{" "}` between
         * two expressions loses its space. Built as strings, it cannot. */}
        <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ash">
          <p>
            {[
              `${person ? `${person}'s` : "Your"} title is two words, and ${person ? "they pick" : "you pick"} neither.`,
              `The second word is what ${person ? "their" : "your"} films keep returning to.`,
              "It is found by theme rather than genre: not “Thriller” but the heists, the time loops, the houses that will not let go.",
              `It is weighed against how common that theme is, so it names what ${person ? "they" : "you"} watch unusually much of rather than what everyone watches.`,
            ].join(" ")}
          </p>
          <p>
            {[
              `The first word is how ${person ? "they" : "you"} watch.`,
              `It is whichever measure ${person ? "their" : "your"} library sits furthest from ordinary on.`,
              `Several of those read ${person ? "their" : "your"} opinions rather than ${person ? "their" : "your"} shelf, which is what separates two people who have seen all the same films.`,
            ].join(" ")}
          </p>
          <p>{`Both are re-read every time ${person ? "their" : "your"} taste moves.`}</p>
        </div>
      </div>

      {a === null ? (
        <p className="mt-7 border-y border-seam py-5 text-[15px] text-paper">
          Not named yet. {binder.toArchetype} more{" "}
          {binder.toArchetype === 1 ? "title" : "titles"} and {person ? "their" : "your"} title is
          read for the first time.
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

/**
 * The four posters on the card, and the job each one is doing.
 *
 * Four unlabelled posters cannot explain themselves, and the selection is the
 * least visible clever thing on the card: without this section nobody would ever
 * learn that one of them is there because they rate it three points above
 * everyone else.
 *
 * So this is the one place that states the whole basis — what makes a title
 * signature-worthy, then the evidence behind each of the four, in facts a reader
 * can check against their own diary. It deliberately never prints a component
 * score: "affection 0.42" explains the algorithm rather than the film, and a
 * number nobody can verify is worse than a sentence they can.
 */
function SignatureSection({ films, person }: { films: Binder["signature"]; person?: string }) {
  if (films.length === 0) return null;

  return (
    <section aria-labelledby="signature" className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <div className="mt-5 max-w-[58ch]">
        <h2 id="signature" className="display text-[26px] leading-none text-paper">
          Signature
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ash">
          Not the four highest ratings. On most shelves those are four versions of the same
          film. Each of these is here for a different reason, and the reason is written under
          it. A series counts as one work, with its seasons as the evidence.
        </p>
        {/* The pairing is the point, and it is invisible without saying so: two
            of the four are chosen to disagree with each other.
         *
         * Built as one string rather than as JSX with pronouns interpolated
         * mid-sentence. A `{" "}` sitting between two expressions lost its space
         * and shipped "what youkeep returning to"; a sentence assembled in one
         * piece cannot do that. */}
        <p className="mt-3 text-sm leading-relaxed text-ash">
          {[
            "Two of them are usually opposites.",
            `One is the clearest example of what ${person ? "they" : "you"} keep returning to.`,
            `Another is the exception: the work that looks nothing like the rest, and ${person ? "they" : "you"} rate it at the top anyway.`,
            "A shelf explains the first one on its own; the second is the part of a taste that nothing else here would tell anyone.",
          ].join(" ")}
        </p>
      </div>

      <ol className="mt-7 flex flex-col gap-5 border-b border-seam pb-6">
        {films.map((f, i) => {
          const poster = posterUrl(f.posterPath, "w154");
          return (
            <li key={f.slug} className="relative flex items-start gap-4 pt-5 first:pt-0">
              {i > 0 && (
                <span
                  aria-hidden
                  className="plate-rule absolute inset-x-0 top-0 h-px bg-seam"
                  style={{ animationDelay: `${i * 40}ms` }}
                />
              )}
              <Link
                href={`/film/${f.slug}`}
                className="block w-[54px] shrink-0 overflow-hidden rounded-[5px] border border-seam bg-tray"
                style={{ aspectRatio: "2/3" }}
              >
                {poster && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-[.14em] text-ash">
                  {person ? inThirdPerson(f.label) : f.label}
                </div>
                <Link
                  href={`/film/${f.slug}`}
                  className="display mt-1 block text-[17px] leading-tight text-paper hover:underline"
                >
                  {f.title}
                </Link>
                <p className="mt-1 max-w-[52ch] text-sm leading-relaxed text-ash">{f.reason}</p>

                {/* The evidence, as facts rather than scores. A reader can check
                    every one of these against their own diary, which is the only
                    thing that makes the selection trustworthy rather than
                    mysterious. */}
                {f.supportingReasons.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {f.supportingReasons.map((s) => (
                      <li key={s} className="text-[11px] leading-snug text-dim">
                        {s}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Said out loud only when it is low. Metadata arrives lazily, and
                    a title chosen on thin information should admit it rather than
                    let the sentence above sound equally certain either way. */}
                {f.confidence < 0.6 && (
                  <p className="mt-2 text-[11px] leading-snug text-dim">
                    Chosen on limited information. Some of this title&rsquo;s details have
                    not been filled in yet.
                  </p>
                )}
              </div>
              <span className={`num shrink-0 text-[17px] ${ratingColor(f.rating)}`}>
                {formatTenths(f.rating)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * What the names on the DNA strip actually mean.
 *
 * Only the themes a library actually runs on. The other thirty-seven are not
 * listed, greyed, or counted against a total: unlike a finish or a tier, a
 * theme is not something to go and collect. It is a description, and the ones
 * that do not describe you are simply not about you.
 */
function ThemesSection({ themes, person }: { themes: Binder["themes"]; person?: string }) {
  if (themes.length === 0) return null;

  return (
    <section aria-labelledby="dna" className="mb-16 scroll-mt-6">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-0.5 w-8 shrink-0 bg-ash" />
        <span aria-hidden className="h-px flex-1 bg-seam" />
      </div>
      <div className="mt-5 max-w-[58ch]">
        <h2 id="dna" className="display text-[26px] leading-none text-paper">
          Taste DNA
        </h2>
        <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ash">
          <p>
            {[
              `The names on the back of ${person ? "their" : "your"} card, and what each one counts.`,
              "A film joins a theme by what it is about rather than what it is filed under, so one film can belong to several.",
            ].join(" ")}
          </p>
          <p>
            {[
              "Every film is filed under one theme here, so the shares are a whole and add to 100.",
              "A film that is two things at once goes to the rarer of them, because that is the one that says something: nearly everything has a family in it somewhere, so a film about witches is filed under witches.",
              "The last row is the rest of the shelf — themes too small to list, and films that fit none.",
            ].join(" ")}
          </p>
          {/* The distinction the old copy blurred: this block is not the one
              that names the card, and saying so stops a reader trying to
              reconcile a 20% share here with a title chosen on a multiple. */}
          <p>
            This is what {person ? "their" : "your"} shelf is made of, which is a different
            question from what is unusual about it. The title above is chosen on the second: a
            theme has to be out of the ordinary to name somebody, and a big theme everybody
            watches never will.
          </p>
        </div>
      </div>

      <dl className="mt-7 border-b border-seam">
        {themes.map((t, i) => (
          <div key={t.key} className="relative py-4">
            <span
              aria-hidden
              className="plate-rule absolute inset-x-0 top-0 h-px bg-seam"
              style={{ animationDelay: `${i * 40}ms` }}
            />
            <div className="flex items-baseline gap-3">
              <dt className="display flex-1 text-[17px] leading-tight text-paper">{t.name}</dt>
              <dd className="num shrink-0 text-[13px] text-ash">
                {t.count} {t.count === 1 ? "title" : "titles"}
              </dd>
              <dd className="num w-14 shrink-0 text-right text-[17px] leading-tight text-paper">
                {t.pct}%
              </dd>
            </div>
            <dd className="mt-1.5 max-w-[62ch] text-sm leading-relaxed text-ash">{t.note}.</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** What the five stars beside the rating actually are. */
const STAR_BANDS = [
  { stars: 5, range: "9.0 and up" },
  { stars: 4, range: "7.0 to 8.9" },
  { stars: 3, range: "5.0 to 6.9" },
  { stars: 2, range: "3.0 to 4.9" },
  { stars: 1, range: "under 3.0" },
];

function StarsSection({ person }: { person?: string }) {
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
          The five stars beside the number on {person ? "their" : "your"} card are that same
          number, rounded to a five-point scale. They are not a second rating, they count nothing
          on their own, and nothing moves them except that average moving. They are there because
          a shape reads across a room and a decimal does not.
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
            <dd className="text-[13px] text-paper">Average {b.range}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PersonalitySection({ rows, person }: { rows: PersonalityRow[]; person?: string }) {
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
          bar, so each bar adds to 100 and every figure is a plain count. Nothing here is a
          target. A bar only appears once enough of {person ? "their" : "your"} library carries
          the thing it measures.
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
                  <dt className="flex-1 text-[13px] text-paper">{band.label}</dt>
                  <dd className="num shrink-0 text-[13px] text-dim">{band.count}</dd>
                  <dd className="num w-12 shrink-0 text-right text-[15px] text-beam">
                    {band.pct}%
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-ash">
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
  return (
    <div>
      {/* Shown on a friend's binder too, told about them rather than to them.
          Hiding the four readings left their binder as a list of finishes with
          the person taken out of it, which is the only part worth looking at. */}
      <ArchetypeSection binder={binder} person={person} />
      <StarsSection person={person} />
      <ThemesSection themes={binder.themes} person={person} />
      <SignatureSection films={binder.signature} person={person} />
      <PersonalitySection rows={binder.personality} person={person} />

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
            Six finishes, in order. Each one is issued at a count of what {person ? "they have" : "you have"}{" "}
            watched, so every tier below the current one was genuinely passed through.
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
                        ? "Issued with the first rating."
                        : `Issued at ${row.tier.depth.toLocaleString()} points: a film is 1, a season is 4.`}{" "}
                      {row.tier.effect}
                    </p>
                    <Distance text={row.distance} />
                  </div>
                  <StateMark state={row.state} markPast={false} />
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
            {/* Counted, not typed. This said "six" while ten were listed
                directly beneath it, because the set grew and the sentence did
                not. A number a reader can check against the list on the same
                screen has to come from the list. */}
            {binder.variants.length} stocks: the ground the card is printed on.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ash">
            A stock reads what {person ? "their" : "your"} films keep returning to, weighed against
            how common that theme is rather than how much of {person ? "their" : "your"} shelf it
            happens to fill.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ash">
            Recent watching counts for more. Nothing is ever dropped and there is no cut-off
            date: a viewing simply counts half as much once it is two years old, and half again
            two years after that. So the stock follows {person ? "their" : "your"} taste rather than
            the calendar, and a shelf {person ? "they" : "you"} built years ago cannot lock it in
            place.
          </p>
          <p className="mt-2.5 text-sm leading-relaxed text-ash">
            Nothing here is chosen. Every stock {person ? "they have" : "you have"} earned stays{" "}
            {person ? "theirs" : "yours"}, whichever one the card happens to be wearing.
          </p>
          {/* The one thing a count of "titles about X" does not say by itself,
              and the reason a title that plainly fits a theme can still not
              move its number. Said once, here, rather than in all twelve rows. */}
          <p className="mt-2.5 text-sm leading-relaxed text-ash">
            A theme is counted by the keywords a title carries, which come from TMDB. A title that
            fits a theme but is not tagged for it does not count toward it, so a number here can
            sit still after {person ? "they log" : "you log"} something that looks like it should
            have moved it.
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
                    <span className="max-w-[46ch]">
                      <Distance text={row.distance} />
                    </span>
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
              {
                title: "Aura",
                note: "The average, read as a whole. Before anything is rated it reads Unexposed.",
                rows: binder.auras,
              },
            ] as { title: string; note: string; rows: AxisRow[] }[]
          ).map((group) => (
            <div key={group.title}>
              <h3 className="display text-[15px] text-paper">{group.title}</h3>
              <p className="mt-1 text-sm text-ash">{group.note}</p>
              {/* One standing per axis, not one per option: every row on an
                  axis is measured against the same figure, so repeating it
                  four times said nothing new three times. */}
              <Distance text={group.rows[0]?.distance ?? null} />
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
                        {person ? "Theirs" : "Yours"}
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
