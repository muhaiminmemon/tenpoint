"use client";

import { useState } from "react";
import TiltCard from "./TiltCard";
import TasteCardFace from "./TasteCardFace";
import TasteCardDialog from "./TasteCardDialog";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * The taste card on someone's profile.
 *
 * The same object the owner sees on their homepage, opening the same flip
 * dialog — a profile is where a visitor most expects to find it, and showing a
 * lesser version there would make the card look like a homepage ornament
 * rather than the thing the account amounts to.
 *
 * What it drops is the homepage's chrome: no share button, no "view card"
 * duplicate, no taste-matching nudge, and no re-mint flash. Those are all
 * addressed to the owner in the middle of their own session, and none of them
 * means anything to someone looking at another person's page.
 *
 * The card it renders is built from public entries only unless the viewer owns
 * it; that decision is made on the server and arrives here already applied.
 */
export default function ProfileTasteCard({
  data,
  username,
  displayName,
  avatarUrl,
  memberNumber,
  memberSince,
  binderHref,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number;
  memberSince: number;
  /** their binder, when the viewer is allowed to see it */
  binderHref?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* The tilt wraps the button alone. The dialog below is `position:
          fixed`, and a transformed ancestor would become its containing block
          and clip it to the card. */}
      <TiltCard radius="0px">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Open ${displayName}'s taste card`}
          className="block w-full p-px text-left"
          style={{
            background: data.tier.border,
            boxShadow: data.tier.glow === "none" ? undefined : data.tier.glow,
          }}
        >
          <TasteCardFace
            data={data}
            username={username}
            displayName={displayName}
            avatarUrl={avatarUrl}
            memberSince={memberSince}
          />
        </button>
      </TiltCard>

      <TasteCardDialog
        open={open}
        onClose={() => setOpen(false)}
        binderHref={binderHref}
        data={data}
        username={username}
        displayName={displayName}
        avatarUrl={avatarUrl}
        memberNumber={memberNumber}
      />
    </div>
  );
}
