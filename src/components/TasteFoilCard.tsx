"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useToast } from "./Toast";
import TasteCardDialog from "./TasteCardDialog";
import TiltCard from "./TiltCard";
import TasteCardFace from "./TasteCardFace";
import { RARITY_TIERS } from "@/lib/taste-card";
import type { HomeTasteCardData } from "@/lib/taste";


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
  // Which panel the dialog opens on. "Share card" and "View card" are two
  // doors into the same object, and sharing now means an image the dialog
  // draws, so the button opens that panel rather than pushing a link.
  const [openTab, setOpenTab] = useState<"Card" | "Share">("Card");
  const [justReminted, setJustReminted] = useState(false);
  const { toast } = useToast();
  const { tier } = data;

  // The moment the tier goes up, played once, in place. `lastSeenTier` is
  // per-browser rather than server state: it is a courtesy animation, not a
  // record of anything.
  //
  // The ref is what makes it survive a double-invoked effect. Without it the
  // first pass wrote the new tier to storage, so the second pass compared the
  // tier against itself, found no change, and the sweep never played in
  // development at all.
  const announced = useRef<string | null>(null);

  useEffect(() => {
    if (announced.current === tier.name) return;
    announced.current = tier.name;

    const key = `tenpoint:lastSeenTier:${userId}`;
    const prev = localStorage.getItem(key);
    localStorage.setItem(key, tier.name);
    if (!prev || prev === tier.name) return;

    const prevIndex = RARITY_TIERS.findIndex((t) => t.name === prev);
    if (prevIndex === -1 || tier.index <= prevIndex) return;

    toast({ message: `Your card just re-minted. ${tier.name} now.` });
    // Both deferred, neither cleared. Off the effect body so a synchronous
    // re-render mid-commit is never triggered, and uncancelled so a teardown
    // cannot swallow the reset and leave the sweep latched on. The guard above
    // is what stops it firing twice.
    setTimeout(() => setJustReminted(true), 0);
    setTimeout(() => setJustReminted(false), 1400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, tier.name, tier.index]);

  return (
    <div>
      {/* The tilt wraps the button alone, never this outer div: a transform
          becomes the containing block for `position: fixed`, and the dialog
          below would be positioned against the card instead of the viewport. */}
      <TiltCard radius="0px">
      <button
        type="button"
        onClick={() => {
          setOpenTab("Card");
          setOpen(true);
        }}
        className={`block w-full p-px text-left ${justReminted ? "card-tier-pop" : ""}`}
        style={{ background: tier.border, boxShadow: tier.glow === "none" ? undefined : tier.glow }}
      >
        <TasteCardFace
          data={data}
          username={username}
          displayName={displayName}
          avatarUrl={avatarUrl}
          memberSince={memberSince}
          flashing={justReminted}
        />
      </button>
      </TiltCard>

      <div className="mx-auto mt-4 flex w-full gap-2.5">
        <button
          type="button"
          onClick={() => {
            setOpenTab("Share");
            setOpen(true);
          }}
          className="display flex-1 rounded-card bg-paper py-2.5 text-[13px] font-medium text-carbon hover:bg-white"
        >
          Share card
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenTab("Card");
            setOpen(true);
          }}
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
        initialTab={openTab}
        data={data}
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        memberNumber={memberNumber}
      />
    </div>
  );
}
