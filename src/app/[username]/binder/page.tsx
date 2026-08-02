import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { loadBinder } from "@/lib/binder";
import { areFriends, isBlockedBetween } from "@/lib/social";
import BinderShowcase from "@/components/BinderShowcase";

export async function generateMetadata(ctx: { params: Promise<{ username: string }> }) {
  const { username } = await ctx.params;
  return { title: `@${username}'s binder` };
}

/**
 * Someone else's binder, readable by their friends.
 *
 * Friends only, deliberately. The binder is a record of finishes a person has
 * held, and opened to everyone it becomes a table of who has more — which is
 * the one thing this feature was built not to be. Between two people who
 * already know each other it is just something to look through.
 *
 * Nothing is written here. `loadBinder` is a pure read, and the write that
 * records a currently-held finish lives on the owner's own binder page, so
 * reading a friend's binder cannot alter their history.
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
  if (!viewer) redirect(`/login?next=/${username}/binder`);
  if (viewer.id === profile.id) redirect("/binder");

  if (await isBlockedBetween(viewer.id, profile.id)) notFound();
  // Not a friend is indistinguishable from not existing, so a stranger cannot
  // learn anything about the account from the response.
  if (!(await areFriends(viewer.id, profile.id))) notFound();

  const binder = await loadBinder(profile);
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
        <h1 className="display mt-3 text-[32px] leading-none">Their binder</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ash">
          Every finish {displayLabel}&apos;s card can be dealt, and which of them are theirs.
          Nothing here was chosen or bought: a finish arrives because of what they watched, and
          leaves the same way.
        </p>
      </header>

      <BinderShowcase binder={binder} person={displayLabel} />
    </div>
  );
}
