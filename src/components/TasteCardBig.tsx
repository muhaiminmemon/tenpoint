import { rankTraits } from "@/lib/taste-card";
import Link from "next/link";
import { accentFor, formatTenths } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import type { HomeTasteCardData } from "@/lib/taste";

function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <span className="text-[8px] uppercase tracking-[0.18em] text-card-3">{children}</span>
      <span className="h-px flex-1 bg-[#1f1f25]" aria-hidden />
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
  // The multiple, in the order the multiple decided. Genres have no multiple,
  // so a library too new for themes keeps showing shares.
  const themed = data.themeDNA.length > 0;
  const dnaSource = themed
    ? data.themeDNA
    : data.genreShare.slice(0, 5).map((g) => ({ ...g, lift: 0 }));
  // Same rule as the chips on the front: chosen by distinctiveness, printed
  // and ordered by share, so the bars, the numbers and the order all agree.
  const genreDNA = [...dnaSource]
    .sort((a, b) => b.pct - a.pct)
    .map((g) => ({ label: g.name, pct: g.pct, dot: accentFor(g.name) }));
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

      {/* The portrait wears the tier, the way the card's own rim does.
       *
       * It used to be a conic of the decade accent plus a hardcoded beam blue
       * and warn red, which was three full-strength hues in one ring and the
       * last place on the card still doing that. Rank is the thing worth
       * showing around a face, and the tier's metal is already guaranteed to
       * sit on any of the ten grounds, so the ring and the rim now agree. */}
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
          <div className="display mt-2 text-[14px]" style={{ color: variant.accentColor }}>
            {data.archetype}
          </div>
        )}
        {data.archetypeMeaning && (
          <p className="mx-4 mt-1.5 text-[11px] leading-snug text-card-2">{data.archetypeMeaning}</p>
        )}
      </div>

      <div className="my-2.5 h-px bg-gradient-to-r from-transparent via-seam to-transparent" />

      {/* movie DNA */}
      {genreDNA.length > 0 && (
        <div>
          <SectionLabel
            right={
              <span className="text-[9px] uppercase tracking-[.12em] text-card-3">
                share of shelf
              </span>
            }
          >
            Taste DNA
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            {genreDNA.map((d) => (
              <div key={d.label} className="flex items-center gap-2.5">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: d.dot }} aria-hidden />
                <span className="w-[104px] truncate text-[11px] text-card-2">{d.label}</span>
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-card-track">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-beam to-gold"
                    style={{ width: `${Math.max(4, d.pct)}%` }}
                  />
                </span>

              </div>
            ))}
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

      {/* footer */}
      <div className="mt-2.5 flex items-center justify-between border-t border-[#1c1c22] pt-2 text-[9px] uppercase tracking-[.08em] text-card-3">
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
    <div className="relative flex flex-col gap-2.5 p-4">
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
          <div className={`grid gap-1.5 ${data.profStats.length > 5 ? "grid-cols-6" : "grid-cols-5"}`}>
            {data.profStats.map((s) => (
              <div key={s.label} className="rounded-[7px] border border-[#232329] bg-white/[.02] py-1.5 text-center">
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
                className="h-full bg-beam"
                style={{
                  width: `${band.pct}%`,
                  opacity: 1 - (i / Math.max(1, all.length)) * 0.62,
                  boxShadow: i === all.length - 1 ? undefined : "inset -1px 0 0 #141417",
                }}
              />
            ))}
          </span>
          <div className="mt-2 grid grid-cols-2 gap-x-3.5 gap-y-1">
            {data.personality[0].bands.map((band, i, all) => (
              <div key={band.label} className="flex items-baseline gap-1.5">
                <span
                  aria-hidden
                  className="size-1.5 shrink-0 rounded-full bg-beam"
                  style={{ opacity: 1 - (i / Math.max(1, all.length)) * 0.62 }}
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
              <div key={f.label} className="flex items-baseline justify-between border-b border-[#1a1a20] pb-1">
                <span className="text-[9px] uppercase tracking-[.08em] text-card-3">{f.label}</span>
                <span className="display text-[12px] text-paper">{f.value}</span>
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
            <div key={i} className="rounded-[7px] border border-[#232329] px-2.5 py-1.5">
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
          <SectionLabel>
            Traits · {data.traitsHeldCount} of {data.traitsTotal}
          </SectionLabel>
          <div className="flex flex-wrap gap-1">
            {heldTraits.map((t) => (
              <span
                key={t.key}
                className="flex items-center gap-1 rounded-full border border-[#3a3320] bg-[rgba(217,178,95,.05)] px-1.5 py-0.5 text-[8.5px] text-[#c9b48a]"
              >
                {t.name}
                {/* The count, which is the thing worth showing at this size.
                    Ranked strongest first, so the ten that fit are the ten
                    that say most. */}
                <span className="num text-[#8a7a55]">{t.count}</span>
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
