import { redirect } from "next/navigation";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { films, listItems, listMembers, lists, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import ListsIndex, { type ListCard } from "@/components/ListsIndex";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await db
    .select({ listId: listMembers.listId, role: listMembers.role })
    .from(listMembers)
    .where(eq(listMembers.userId, user.id));

  const ids = memberships.map((m) => m.listId);
  const myRole = new Map(memberships.map((m) => [m.listId, m.role]));

  /**
   * Counted with a join rather than a correlated subquery: inside a raw `sql`
   * fragment Drizzle emits bare column names, and `"id"` there binds to
   * list_items' own id, so every list came back as 0.
   *
   * The two kind counts are separate because a list holding four films and two
   * seasons cannot honestly be called six films — PRODUCT.md's rule is that a
   * count mixing the two says what it counts. `editedAt` is derived rather than
   * stored: `lists` has no updated_at, and sorting by creation buried a list the
   * moment you finished filling it.
   */
  const rows = ids.length
    ? await db
        .select({
          id: lists.id,
          title: lists.title,
          description: lists.description,
          ownerId: lists.ownerId,
          pairKey: lists.pairKey,
          createdAt: lists.createdAt,
          count: sql<number>`count(${listItems.id})::int`,
          screenCount: sql<number>`count(${listItems.id}) filter (where ${films.kind} <> 'movie')::int`,
          // Typed as a string, not a Date: a raw `sql` fragment gets no
          // driver type parser, so this arrives as the timestamp text and a
          // `Date` annotation here would only be a lie tsc cannot check.
          editedAt: sql<string | null>`max(${listItems.createdAt})`,
        })
        .from(lists)
        .leftJoin(listItems, eq(listItems.listId, lists.id))
        .leftJoin(films, eq(films.id, listItems.filmId))
        .where(inArray(lists.id, ids))
        .groupBy(lists.id, lists.title, lists.description, lists.ownerId, lists.pairKey, lists.createdAt)
    : [];

  // first few posters per list, for the generated covers
  const coverByList = new Map<string, (string | null)[]>();
  if (rows.length) {
    const covers = await db
      .select({ listId: listItems.listId, posterPath: films.posterPath })
      .from(listItems)
      .innerJoin(films, eq(films.id, listItems.filmId))
      .where(inArray(listItems.listId, ids))
      .orderBy(asc(listItems.position), asc(listItems.createdAt));
    for (const c of covers) {
      const list = coverByList.get(c.listId) ?? [];
      if (list.length < 4) list.push(c.posterPath);
      coverByList.set(c.listId, list);
    }
  }

  // who else is on each list, for the overlapping avatars
  const memberRows = (
    rows.length
      ? await db
          .select({
            listId: listMembers.listId,
            userId: users.id,
            username: users.username,
            displayName: users.displayName,
            avatarUpdatedAt: users.avatarUpdatedAt,
          })
          .from(listMembers)
          .innerJoin(users, eq(users.id, listMembers.userId))
          .where(inArray(listMembers.listId, ids))
      : []
  ).map(({ avatarUpdatedAt, ...m }) => ({ ...m, avatarUrl: avatarSrc(m.userId, avatarUpdatedAt) }));

  const membersByList = new Map<string, typeof memberRows>();
  for (const m of memberRows) {
    const list = membersByList.get(m.listId) ?? [];
    list.push(m);
    membersByList.set(m.listId, list);
  }

  const cards: ListCard[] = rows.map((l) => {
    const members = membersByList.get(l.id) ?? [];
    return {
      id: l.id,
      title: l.title,
      description: l.description,
      count: l.count,
      screenCount: l.screenCount,
      role: (myRole.get(l.id) ?? "viewer") as ListCard["role"],
      mine: l.ownerId === user.id,
      // The one list neither person made on purpose: "What should we watch?"
      // creates it, and it belongs to the pair rather than to either of them.
      pair: l.pairKey !== null,
      createdAt: l.createdAt.toISOString(),
      editedAt: new Date(l.editedAt ?? l.createdAt).toISOString(),
      posters: coverByList.get(l.id) ?? [],
      // Everyone but you: the card is already yours, so your own face in the
      // stack says nothing and costs a slot.
      others: members
        .filter((m) => m.userId !== user.id)
        .map((m) => ({ userId: m.userId, name: m.displayName ?? m.username, avatarUrl: m.avatarUrl })),
    };
  });

  return <ListsIndex cards={cards} viewerId={user.id} />;
}
