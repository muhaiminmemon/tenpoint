import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { areFriends } from "@/lib/social";
import RecsView from "@/components/RecsView";

export const metadata = { title: "What should we watch?" };

export default async function WatchPage(ctx: { params: Promise<{ a: string; b: string }> }) {
  const { a, b } = await ctx.params;
  const viewer = await getSessionUser();
  if (!viewer) redirect(`/login?next=/watch/${a}/${b}`);

  const names = [a.toLowerCase(), b.toLowerCase()];
  if (!names.includes(viewer.username)) notFound();
  const otherName = names.find((n) => n !== viewer.username);
  if (!otherName) notFound();

  const other = (
    await db.select().from(users).where(eq(users.username, otherName)).limit(1)
  )[0];
  if (!other || !(await areFriends(viewer.id, other.id))) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="display text-2xl">What should we watch?</h1>
      <p className="mt-1 text-sm text-ash">
        Five films neither you nor {other.displayName ?? other.username} has logged.
      </p>
      <div className="mt-6">
        <RecsView friend={other.username} />
      </div>
    </div>
  );
}
