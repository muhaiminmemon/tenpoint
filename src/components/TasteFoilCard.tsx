"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "./Toast";
import TasteCardDialog from "./TasteCardDialog";
import FoilLight, { CARD_FOIL } from "./FoilLight";
import { accentFor, formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";
import { RARITY_TIERS, stockDef } from "@/lib/taste-card";
import type { HomeTasteCardData } from "@/lib/taste";

function Stars({ mean }: { mean: number }) {
  const filled = Math.max(1, Math.min(5, Math.round(mean / 20)));
  return (
    <span className="num text-[10px] tracking-[0.1em] text-gold">
      {"★".repeat(filled)}
      <span className="text-seam">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

/**
 * The taste-card teaser that lives on the homepage: a compact preview of the
 * front face, styled to the account's current rarity tier. Clicking it (or
 * "View card") opens the full, flippable card in `TasteCardDialog` — the
 * home slot itself never flips, matching the design's "210px sliver, click
 * it and the room goes dark" behaviour.
 */
export default function TasteFoilCard({
  data,
  username,
  displayName,
  avatarUrl,
  userId,
  memberNumber,
  memberSince,
  hasFriend,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  userId: string;
  memberNumber: number;
  memberSince: number;
  hasFriend: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [justReminted, setJustReminted] = useState(false);
  const { toast } = useToast();
  const { tier, variant } = data;
  const stock = stockDef(variant.stock);

  // A one-time flash the moment the account's tier goes up from last visit —
  // no modal, no confetti, just the card re-foiling in place. `lastSeenTier`
  // is per-browser, not persisted server-side: it's a courtesy animation,
  // not a source of truth.
  useEffect(() => {
    const key = `tenpoint:lastSeenTier:${userId}`;
    const prev = localStorage.getItem(key);
    localStorage.setItem(key, tier.name);
    if (!prev || prev === tier.name) return;
    const prevIndex = RARITY_TIERS.findIndex((t) => t.name === prev);
    if (prevIndex === -1 || tier.index <= prevIndex) return;
    toast({ message: `Your card just re-minted. ${tier.name} now.` });
    const start = setTimeout(() => setJustReminted(true), 0);
    const end = setTimeout(() => setJustReminted(false), 1200);
    return () => {
      clearTimeout(start);
      clearTimeout(end);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tier.name]);

  async function share() {
    const url = typeof window !== "undefined" ? `${location.origin}/${username}` : `/${username}`;
    const text = `${data.archetype ?? "My taste card"}: ${data.rated} films, ${
      data.mean !== null ? formatTenths(data.mean) : "—"
    } average.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My taste card", text, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ message: "Profile link copied." });
    } catch {
      toast({ message: "Couldn't copy the link.", tone: "warn" });
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`block w-full rounded-[20px] p-px text-left ${justReminted ? "card-tier-pop" : ""}`}
        style={{ background: tier.border, boxShadow: tier.glow === "none" ? undefined : tier.glow }}
      >
        {/* Two materials, one per axis the card actually has. The rim is the
            tier, because rarity should stay the loudest signal; the ground is
            the stock. Nothing decorative sits between them — a third material
            with no axis behind it would be a finish the binder can't explain. */}
        <div
          className="relative overflow-hidden rounded-[19px]"
          style={{ background: stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)" }}
        >
          {stock?.texture && (
            <span aria-hidden className="absolute inset-0" style={{ backgroundImage: stock.texture }} />
          )}
          {justReminted && (
            <div
              aria-hidden
              className="card-flash-out pointer-events-none absolute inset-0 z-10"
              style={{
                background:
                  "radial-gradient(circle at 50% 40%, rgba(255,255,255,.9), rgba(217,178,95,.3) 45%, transparent 72%)",
              }}
            />
          )}
          <FoilLight intensity={tier.sheenOp * CARD_FOIL} sweepSec={tier.sweepSec} />

          <div className="relative p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="size-7 rounded-full object-cover" />
                ) : (
                  <span className="display flex size-7 items-center justify-center rounded-full bg-tray text-xs text-paper">
                    {displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <div className="display text-[13px] text-beam">@{username}</div>
                  <div className="num text-[9px] uppercase tracking-[0.14em] text-dim">Since {memberSince}</div>
                </div>
              </div>
              {data.mean !== null && (
                <div className="text-right">
                  <div className={`num text-[26px] leading-none ${ratingColor(data.mean)}`}>
                    {formatTenths(data.mean)}
                  </div>
                  <div className="mt-1">
                    <Stars mean={data.mean} />
                    <span
                      className="ml-1.5 text-[9px] uppercase tracking-[0.1em]"
                      style={{ color: tier.labelColor }}
                    >
                      {tier.name}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div className="text-[10px] uppercase tracking-[0.18em] text-ash">Taste class</div>
                {variant.name && (
                  <div className="display text-[9px] uppercase tracking-[.08em]" style={{ color: variant.accentColor }}>
                    {variant.name}
                  </div>
                )}
              </div>
              <div className="display mt-1 text-[20px] leading-[1.05] text-paper">{data.archetype}</div>
            </div>

            {data.topGenres.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {data.topGenres.slice(0, 3).map((g) => (
                  <span
                    key={g.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-seam bg-[rgba(255,255,255,.04)] px-2.5 py-1 text-[11px] text-paper"
                  >
                    <span className="size-1.5 rounded-full" style={{ background: accentFor(g.name) }} aria-hidden />
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {data.signatureFilms.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {data.signatureFilms.map((f) => {
                  const poster = posterUrl(f.posterPath, "w154");
                  return (
                    <div
                      key={f.slug}
                      className="relative overflow-hidden rounded-[5px] border border-seam bg-tray"
                      style={{ aspectRatio: "2/3" }}
                    >
                      {poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={poster} alt="" loading="lazy" className="size-full object-cover" />
                      ) : (
                        <span className="flex size-full items-center justify-center p-1 text-center text-[8px] text-ash">
                          {f.title}
                        </span>
                      )}
                      <span
                        className="absolute left-1 top-1 h-3.5 w-[3px] rounded-[2px]"
                        style={{ background: accentFor(f.slug) }}
                        aria-hidden
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {data.traitsHeldCount > 0 && (
              <div className="mt-4 flex items-center gap-2.5 border-t border-seam pt-3">
                <span className="num text-[10px] text-gold">{data.traitsHeldCount} traits</span>
              </div>
            )}
          </div>
        </div>
      </button>

      <div className="mx-auto mt-4 flex w-full gap-2.5">
        <button
          type="button"
          onClick={share}
          className="display flex-1 rounded-card bg-paper py-2.5 text-[13px] font-medium text-carbon hover:bg-white"
        >
          Share card
        </button>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-1 rounded-card border border-seam bg-tray py-2.5 text-[13px] text-ash hover:text-paper"
        >
          View card →
        </button>
      </div>

      {data.rated < 5 ? (
        <p className="mt-2.5 text-xs text-ash">
          Rate {5 - data.rated} more to unlock taste-matching with friends.
        </p>
      ) : !hasFriend ? (
        <p className="mt-2.5 text-xs text-ash">
          Taste-matching is on.{" "}
          <Link href="/friends" className="text-beam hover:underline">
            Find a friend
          </Link>{" "}
          to compare.
        </p>
      ) : null}

      <TasteCardDialog
        open={open}
        onClose={() => setOpen(false)}
        data={data}
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        memberNumber={memberNumber}
      />
    </div>
  );
}
