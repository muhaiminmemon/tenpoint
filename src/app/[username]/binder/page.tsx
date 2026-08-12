import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { loadBinder } from "@/lib/binder";
import { canViewProfile } from "@/lib/social";
import BinderShowcase from "@/components/BinderShowcase";

export async function generateMetadata(ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  return { title: `@${username}'s binder` };
}

/**
 * Someone else's binder, readable by whoever can read their profile.
 *
 * This was friends-only on the reasoning that a binder opened to everyone
 * becomes a table of who has more. What actually stops that is the absence of a
 * denominator: there is no total, no ratio and no completion figure anywhere on
 * the page, so there is nothing to rank on. That rule is what makes the page
 * safe to open, and it is the rule to defend if anything ever wants to add a
 * count.
 *
 * Visibility is therefore the account's own, not a second policy invented here.
 * `canViewProfile` already answers it — owner, blocks, `public`, `friends`,
 * `private` — so a binder is exactly as reachable as the profile that links to
 * it, and a person who sets their account to friends-only keeps the old
 * behaviour without having to know this page exists.
 *
 * Nothing is written here. `loadBinder` is a pure read, and the write that
 * records a currently-held finish lives on the owner's own binder page, so
 * reading somebody else's binder cannot alter their history.
 *
 * An owner landing on their own username is sent to `/binder`, so the canonical
 * route stays the one place their finish gets recorded.
 */
export default async function FriendBinderPage(ctx: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await ctx.params;

  const profile = (
    await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1)
  )[0];
  if (!profile) notFound();

  const viewer = await getSessionUser();
  if (viewer?.id === profile.id) redirect("/binder");

  // Out of view is indistinguishable from not existing, so somebody who cannot
  // read the account learns nothing about it from the response. No login gate:
  // a public profile is readable signed out, and its binder has to match or the
  // link on the profile leads somewhere the profile itself does not.
  if (!(await canViewProfile(viewer, profile))) notFound();

  const binder = await loadBinder(profile, { thirdPerson: true });
  const displayLabel = profile.displayName ?? profile.username;

  return (
    <div>
      <header className="mb-12 max-w-[58ch]">
        <Link
          href={`/${profile.username}`}
          className="text-[13px] text-ash transition-colors hover:text-paper"
        >
          &larr; {displayLabel}
        </Link>
        <h1 className="display mt-3 text-[32px] leading-none">{displayLabel}&apos;s binder</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          What {displayLabel}&apos;s card is made of, and why it reads the way it does. Nothing
          here was chosen or bought: every part of it arrives because of what they watched, and
          leaves the same way.
        </p>
      </header>

      <BinderShowcase binder={binder} person={displayLabel} />
    </div>
  );
}
