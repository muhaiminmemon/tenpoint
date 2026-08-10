import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { friendRequests, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { friendsOf, ratedTitleCounts } from "@/lib/social";
import { eligibilityOf } from "@/lib/recs";
import { avatarSrc } from "@/lib/avatar";
import FriendsPanel from "@/components/FriendsPanel";

export const metadata = { title: "Friends" };

export default async function FriendsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const friends = await friendsOf(user.id);
  /**
   * Titles, counted once each, in one query rather than one per friend.
   *
   * This used to read the recommender's eligibility count, which is a count of
   * rated rows because that is what the recommender needs — a season is a real
   * opinion to it. Beside a name it is the wrong number: it made three
   * programmes watched properly read larger than thirty-eight films.
   */
  const titles = await ratedTitleCounts(friends.map((f) => f.id));
  const withEligibility = friends.map((f) => ({
    id: f.id,
    username: f.username,
    displayName: f.displayName,
    avatarUrl: avatarSrc(f.id, f.avatarUpdatedAt),
    rated: titles.get(f.id) ?? 0,
  }));

  const fromUser = alias(users, "from_user");
  const incomingRows = await db
    .select({
      requestId: friendRequests.id,
      userId: fromUser.id,
      username: fromUser.username,
      displayName: fromUser.displayName,
      avatarUpdatedAt: fromUser.avatarUpdatedAt,
    })
    .from(friendRequests)
    .innerJoin(fromUser, eq(fromUser.id, friendRequests.fromId))
    .where(eq(friendRequests.toId, user.id));
  const incoming = incomingRows.map(({ avatarUpdatedAt, ...r }) => ({
    ...r,
    avatarUrl: avatarSrc(r.userId, avatarUpdatedAt),
  }));

  const toUser = alias(users, "to_user");
  const outgoingRows = await db
    .select({
      userId: toUser.id,
      username: toUser.username,
      displayName: toUser.displayName,
      avatarUpdatedAt: toUser.avatarUpdatedAt,
    })
    .from(friendRequests)
    .innerJoin(toUser, eq(toUser.id, friendRequests.toId))
    .where(eq(friendRequests.fromId, user.id));
  const outgoing = outgoingRows.map(({ avatarUpdatedAt, ...r }) => ({
    ...r,
    avatarUrl: avatarSrc(r.userId, avatarUpdatedAt),
  }));

  return (
    <div className="max-w-xl">
      <h1 className="display mb-6 text-2xl">Friends</h1>
      <FriendsPanel
        me={user.username}
        friends={withEligibility}
        incoming={incoming}
        outgoing={outgoing}
      />
    </div>
  );
}
