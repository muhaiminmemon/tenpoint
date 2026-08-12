import { rankTraits } from "@/lib/taste-card";
import Link from "next/link";
import { formatTenths } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * The rating scale, drawn to survive twelve stocks.
 *
 * A fixed hue cannot. The grounds run brown, teal, maroon, rust, olive and
 * indigo, so any one colour lands near-complementary to several of them — which
 * is what the beam blue was doing on every warm stock. Gold is the single
 * exception, because it is already printed on every card regardless of ground
 * (the traits dot, the trait pills) and because the product already means
 * "exceptional" by it: `ratingColor` gives gold to 9.0 and above.
 *
 * Below the top step the scale is white at falling alpha, for exactly the
 * reason `card-2` and `card-track` are: white takes the hue of whatever it is
 * printed on, so it cannot go muddy on a stock, including one that does not
 * exist yet. The result reads as one scale rather than four unrelated hues.
 */
const RATE_BANDS = [
  "#d9b25f",
  "rgba(236,234,230,.85)",
  "rgba(236,234,230,.55)",
  "rgba(236,234,230,.3)",
];

const bandColor = (i: number) => RATE_BANDS[Math.min(i, RATE_BANDS.length - 1)];

function SectionLabel({
  children,
  right,
  center = false,
}: {
  children: React.ReactNode;
  right?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`mb-1.5 flex items-center gap-2 ${center ? "justify-center" : ""}`}>
      <span className="text-[8px] uppercase tracking-[0.18em] text-card-3">{children}</span>
      {/* The spacer is what pushes a right-hand label to the edge; centring a
          lone label means there is nothing to push. */}
      {!center && <span className="flex-1" aria-hidden />}
      {right}
    </div>
  );
}

/**
 * The big, detailed taste card — front and back — used inside the expanded
 * popup. The home page shows a lighter teaser (`TasteFoilCard`); this is the
 * "opened properly" version with the full rarity ribbon, movie DNA, profile
 * stats and traits.
 */
export function TasteCardFrontBig({
  data,
  username,
  displayName,
  avatarUrl,
  memberNumber,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number;
}) {
  const { tier, variant } = data;
  // Themes, not genre tags. Genre tags gave nearly everybody the same three
  // lines; a theme is the thing a library keeps returning to. Falls back to
  // genres for a library too new for any theme to have emerged.
  const themed = data.themeDNA.length > 0;
  const dnaSource = themed ? data.themeDNA : data.genreShare.slice(0, 5);
  /**
   * Left in the order it arrives.
   *
   * These used to be re-sorted by share here, which was harmless while every
   * row was a theme and actively wrong once the last row became "Everything
   * else": the remainder is usually the largest single share on a varied
   * shelf, so sorting floated it to the top and the breakdown opened with the
   * bucket that says the least. The reading already comes out biggest-first
   * with the remainder last.
   */
  const genreDNA = dnaSource.map((g) => ({
    label: g.name,
    pct: g.pct,
    rest: "key" in g && g.key === "rest",
  }));
  /**
   * Four themes, and a mark for the rest.
   *
   * The remainder row is dropped rather than carried, because it is only
   * meaningful as the closing term of a whole: once the list is capped the
   * shares stop summing to one, and "Everything else" beside four of eight
   * themes states a number that completes nothing. `TasteCardFace` drops it for
   * the same reason. The binder reads ten themes to this card's four, so the
   * mark has somewhere real to point.
   */
  const themeRows = genreDNA.filter((d) => !d.rest);
  const shownDNA = themeRows.slice(0, 4);
  const moreThemes = themeRows.length - shownDNA.length;
  const signature = data.signatureFilms[0];

  return (

    <div className="relative flex flex-col p-4">
      {/* Drifting light, and only at the top.
       *
       * These lit at 0.42, which is Epic, whose finish reads "Silver foil,
       * quiet shimmer" and promises no particles at all; Mythic's is the one
       * that says "Full foil, drifting light, particles". The threshold is now
       * Mythic's own sheen, so the copy and the card agree and the last rung
       * has something no other rung has. */}
      {tier.sheenOp >= 0.7 && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <span className="card-float-a absolute bottom-6 left-[18%] size-[3px] rounded-full bg-[rgba(236,234,230,.9)]" />
          <span
            className="card-float-b absolute bottom-3 left-[42%] size-[2px] rounded-full bg-[rgba(231,217,240,.8)]"
            style={{ animationDelay: "1.4s" }}
          />
          <span
            className="card-float-a absolute bottom-7 left-[66%] size-[3px] rounded-full bg-[rgba(236,220,192,.8)]"
            style={{ animationDelay: ".8s" }}
          />
          <span
            className="card-float-b absolute bottom-4 left-[82%] size-[2px] rounded-full bg-[rgba(214,230,224,.75)]"
            style={{ animationDelay: "2.2s" }}
          />
        </div>
      )}

      {/* rarity ribbon */}
      <div className="flex items-center justify-between">
        <span
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[.22em]"
          style={{ color: tier.labelColor }}
        >
          <span aria-hidden>◆</span>
          {tier.name}
        </span>
        <span className="flex flex-col items-end gap-px">
          <span className="display text-[10px] uppercase tracking-[.1em]" style={{ color: variant.accentColor }}>
            {variant.name || "None yet"}
          </span>
        </span>
      </div>

      {/* The portrait wears the tier, the way the card's own rim does. */}
      <div
        className="relative mx-auto mt-3 size-[86px] rounded-full p-0.5"
        style={{
          background: tier.borderFlat ?? tier.border,
          boxShadow: tier.glow !== "none" ? tier.glow : undefined,
        }}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-full rounded-full object-cover" />
        ) : (
          <span className="display flex size-full items-center justify-center rounded-full bg-tray text-2xl text-paper">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      {/* identity */}
      <div className="mt-3 text-center">
        <div className="display text-[22px] leading-none text-paper">{displayName.toUpperCase()}</div>
        <div className="num mt-1 text-[11px] text-card-2">@{username}</div>
        {data.archetype && (
          <div className="display mt-2 text-[15px]" style={{ color: variant.accentColor }}>
            {data.archetype}
          </div>
        )}
        {data.archetypeMeaning && (
          <p className="mx-4 mt-1.5 text-[11px] leading-snug text-card-2">{data.archetypeMeaning}</p>
        )}
      </div>

      {/* movie DNA */}
      {shownDNA.length > 0 && (
        <div className="mt-5">
          <SectionLabel
            right={
              <span className="text-[9px] uppercase tracking-[.12em] text-card-3">
                share of shelf
              </span>
            }
          >
            Taste DNA
          </SectionLabel>
          <div className="grid gap-y-2">
            {shownDNA.map((d) => (
              <div key={d.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 gap-y-1">
                <span className="truncate text-[11px] leading-tight text-paper">{d.label}</span>
                <span className="num text-[11px] leading-tight text-paper">{d.pct}%</span>
                <span className="col-span-2 block h-px overflow-hidden bg-[rgba(236,234,230,.18)]">
                  <span
                    className="block h-full bg-beam"
                    style={{ width: `${Math.max(1.5, d.pct)}%` }}
                  />
                </span>
              </div>
            ))}
            {/* The rest of the shelf lives in the binder, which reads ten themes
                to this card's four. The mark wears the tier so it reads as part
                of the card's own printing rather than as a truncation glyph. */}
            {moreThemes > 0 && (
              <div className="mt-1 text-center">
                <div
                  aria-hidden
                  className="display text-[26px] leading-none"
                  style={{ color: tier.labelColor }}
                >
                  &hellip;
                </div>
                {/* The line carries the meaning, so the mark above it is
                    decorative and hidden from the reader that cannot see it. */}
                <p className="mt-2 text-[11px] leading-snug text-card-2">
                  Open the binder for the full share
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* signature + avg */}
      <div className="mt-3 flex items-end justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-8 shrink-0 overflow-hidden rounded-[4px] border border-seam bg-tray" style={{ aspectRatio: "2/3" }}>
            {signature &&
              (posterUrl(signature.posterPath, "w154") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl(signature.posterPath, "w154")!} alt="" className="size-full object-cover" />
              ) : null)}
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-[.1em] text-card-3">Signature</div>
            <div className="display max-w-[190px] text-[12px] leading-tight text-paper sm:max-w-[120px]">
              {signature?.title ?? "None yet"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="num text-[30px] leading-none text-paper">
            {data.mean !== null ? formatTenths(data.mean) : "-"}
          </div>
          <div className="mt-0.5 text-[9px] uppercase tracking-[.1em] text-card-3">career avg</div>
        </div>
      </div>

      {/* footer
       *
       * The rule wears the tier, the way the portrait ring and the card's own
       * rim do. A gradient cannot ride on `border-t`, so the line is its own
       * 1px surface painted with the same material, and it reads `borderFlat`
       * first for the conic tiers exactly as the ring does. */}
      <div
        aria-hidden
        className="mt-2.5 h-px"
        style={{ background: tier.borderFlat ?? tier.border }}
      />
      <div className="flex items-center justify-between pt-2 text-[9px] uppercase tracking-[.08em] text-card-3">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-[5px] rounded-full"
            style={{ background: "#d9b25f", boxShadow: "0 0 8px rgba(217,178,95,.6)" }}
          />
          <span className="text-card-3">{data.traitsHeldCount} traits</span>
        </span>
        <span>No. {String(memberNumber).padStart(4, "0")}</span>
      </div>
    </div>

  );
}

export function TasteCardBackBig({
  data,
  username,
  displayName,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
}) {
  // Strongest first, so the eight that fit are the eight worth showing rather
  // than whichever happen to sit at the top of the catalogue.
  const heldTraits = rankTraits(data.traits).slice(0, 10);

  return (
    // `relative` is load-bearing: the foil behind this face is absolutely
    // positioned, and a static root would let it paint over the type.
    // Every rim and rule on this face is cut from one material, published once
    // here so a panel never has to reach for the tier itself.
    <div
      className="relative flex flex-col gap-2.5 p-4"
      style={{ "--tier-rim": data.tier.borderFlat ?? data.tier.border } as React.CSSProperties}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[9px] uppercase tracking-[.18em] text-card-3">Profile</div>
          <div className="display text-[16px] text-paper">
            {displayName} <span className="num text-[11px] text-card-2">@{username}</span>
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-[.2em]" style={{ color: data.tier.labelColor }}>
          ◆ {data.tier.name}
        </span>
      </div>

      {data.profStats.length > 0 && (
        <div>
          <SectionLabel>Profile stats</SectionLabel>
          <div className={`grid gap-1.5 ${data.profStats.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
            {data.profStats.map((s) => (
              <div key={s.label} className="tier-rim rounded-[7px] bg-white/[.02] py-1.5 text-center">
                <div className="num text-[14px] text-paper">{s.value}</div>
                <div className="mt-0.5 text-[7px] uppercase tracking-[.04em] text-card-3">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.personality.length > 0 && (
        <div>
          {/* One axis, whole, rather than the leading band of four.
              Four leads come from four different denominators, so they add up
              to nothing in particular; a single partition drawn end to end is
              a bar that fills exactly once and a set of numbers that reaches
              100 because it is one library cut four ways. The axis is the
              first one, which is the only one that needs no metadata to exist
              and the most personal thing on the card: where your ratings
              land. */}
          <SectionLabel>{data.personality[0].title}</SectionLabel>
          <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-[#1f1f25]">
            {data.personality[0].bands.map((band, i, all) => (
              <span
                key={band.label}
                className="h-full"
                style={{
                  width: `${band.pct}%`,
                  background: bandColor(i),
                  boxShadow: i === all.length - 1 ? undefined : "inset -1px 0 0 #141417",
                }}
              />
            ))}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-1">
            {data.personality[0].bands.map((band, i) => (
              <div key={band.label} className="flex items-baseline gap-1.5">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: bandColor(i) }}
                />
                <span className="flex-1 truncate text-[10px] text-card-2">
                  {band.label.split(",")[0]}
                </span>
                <span className="num shrink-0 text-[10px] text-card-2">{band.pct}%</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 text-[9px] text-card-3">
            {data.personality[0].basis}. The rest is in the binder.
          </div>
        </div>
      )}

      {data.favsCard.length > 0 && (
        <div>
          <SectionLabel>Most watched</SectionLabel>
          <div className="flex flex-col gap-1">
            {data.favsCard.map((f) => (
              // The rule is its own 1px surface rather than a `border-b`, for
              // the same reason the rims are masked: it has to carry a gradient.
              <div key={f.label}>
                <div className="flex items-baseline justify-between pb-1">
                  <span className="text-[9px] uppercase tracking-[.08em] text-card-3">{f.label}</span>
                  <span className="display text-[12px] text-paper">{f.value}</span>
                </div>
                <div aria-hidden className="h-px" style={{ background: "var(--tier-rim)" }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {data.social.length > 0 && (
        <div className={`grid gap-2 ${data.social.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {/* One panel when nobody sits far enough away to be a rival. Naming
              the least-close of two friends a rival is arithmetic, not a
              reading. */}
          {data.social.map((s, i) => (
            <div key={i} className="tier-rim rounded-[7px] px-2.5 py-1.5">
              <div className="text-[8px] uppercase tracking-[.1em] text-card-3">
                {i === 0 ? "Closest taste" : "Furthest taste"}
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <span className="display truncate text-[13px] text-paper">{s.name}</span>
                <span className="num shrink-0 text-[12px]" style={{ color: s.color }}>
                  {s.pct}%
                </span>
              </div>
              <div className="mt-0.5 text-[8px] leading-snug text-card-3">{s.basis}</div>
            </div>
          ))}
        </div>
      )}

      {heldTraits.length > 0 && (
        <div>
          <SectionLabel center>
            Traits · {data.traitsHeldCount} of {data.traitsTotal}
          </SectionLabel>
          {/* Etched, not badged.
           *
           * The pill drew a container around every trait and tinted the lot
           * gold, which put ten small buttons on a card that has nothing to
           * press and spent the product's one warm accent on its least
           * important row. Cut instead: the name sits in the stock with a
           * single hairline of light along its lower edge, the way an
           * incision catches light from above. No border, no fill, no hue —
           * so it reads the same on all twelve grounds. */}
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-center">
            {heldTraits.map((t) => (
              // Ranked strongest first, so the ten that fit are the ten that
              // say most. The count is dropped: at this size it read as a
              // score beside a name it does not score.
              <span key={t.key} className="text-[10px] text-card-2">
                {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-1 text-center text-[9px] uppercase tracking-[.12em] text-card-3">
        Click to flip back
      </div>
    </div>
  );
}

/**
 * The way through to the binder. Only the link: the binder page opens by
 * explaining itself, so saying the same thing here first is a paragraph the
 * reader has to get past twice.
 */
export function BinderLink({ href = "/binder", label = "Open the binder" }: {
  /** whose binder: someone else's card opens theirs, not the reader's */
  href?: string;
  label?: string;
}) {
  return (
    <div>
      <Link
        href={href}
        className="display flex items-center justify-between rounded-card border border-seam bg-[#1a1a1f] px-3.5 py-2.5 text-[13px] text-paper transition-colors hover:border-dim"
      >
        {label}
      </Link>
    </div>
  );
}
