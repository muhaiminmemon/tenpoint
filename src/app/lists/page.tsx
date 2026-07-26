import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { films, listItems, listMembers, lists, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import NewListForm from "@/components/NewListForm";
import ListCover from "@/components/ListCover";
import Avatar from "@/components/Avatar";

export const metadata = { title: "Lists" };

export default async function ListsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const memberships = await db
    .select({ listId: listMembers.listId })
    .from(listMembers)
    .where(eq(listMembers.userId, user.id));

  // Counted with a join rather than a correlated subquery: inside a raw `sql`
  // fragment Drizzle emits bare column names, and `"id"` there binds to
  // list_items' own id, so every list came back as 0.
  const myLists = memberships.length
    ? await db
        .select({
          id: lists.id,
          title: lists.title,
          description: lists.description,
          createdAt: lists.createdAt,
          count: sql<number>`count(${listItems.id})::int`,
        })
        .from(lists)
        .leftJoin(listItems, eq(listItems.listId, lists.id))
        .where(inArray(lists.id, memberships.map((m) => m.listId)))
        .groupBy(lists.id, lists.title, lists.description, lists.createdAt)
        .orderBy(desc(lists.createdAt))
    : [];

  // first few posters per list, for the generated covers
  const coverByList = new Map<string, (string | null)[]>();
  if (myLists.length) {
    const covers = await db
      .select({
        listId: listItems.listId,
        posterPath: films.posterPath,
      })
      .from(listItems)
      .innerJoin(films, eq(films.id, listItems.filmId))
      .where(inArray(listItems.listId, myLists.map((l) => l.id)))
      .orderBy(asc(listItems.position), asc(listItems.createdAt));
    for (const c of covers) {
      const list = coverByList.get(c.listId) ?? [];
      if (list.length < 4) list.push(c.posterPath);
      coverByList.set(c.listId, list);
    }
  }

  // who else is on each list, for the overlapping avatars
  const memberRows = (
    myLists.length
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
          .where(inArray(listMembers.listId, myLists.map((l) => l.id)))
      : []
  ).map(({ avatarUpdatedAt, ...m }) => ({
    ...m,
    avatarUrl: avatarSrc(m.userId, avatarUpdatedAt),
  }));
  const membersByList = new Map<string, typeof memberRows>();
  for (const m of memberRows) {
    const list = membersByList.get(m.listId) ?? [];
    list.push(m);
    membersByList.set(m.listId, list);
  }

  return (
    <div className="max-w-xl">
      <h1 className="display mb-6 text-2xl">Lists</h1>
      <NewListForm />
      {myLists.length === 0 ? (
        <p className="mt-6 text-ash">
          No lists yet. Make one, or save a pick from “What should we watch?”, which starts a
          shared list automatically.
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          {myLists.map((l) => (
            <li key={l.id}>
              <Link href={`/lists/${l.id}`} className="group block">
                <ListCover
                  posterPaths={coverByList.get(l.id) ?? []}
                  size="full"
                  className="transition-opacity group-hover:opacity-90"
                />
                <span className="display mt-2 block text-[13px] leading-tight text-paper">
                  {l.title}
                </span>
                <span className="mt-1 flex items-center justify-between gap-2">
                  <span className="num text-[11px] text-ash">
                    {l.count} {l.count === 1 ? "film" : "films"}
                  </span>
                  <span className="flex">
                    {(membersByList.get(l.id) ?? []).slice(0, 3).map((m) => (
                      <span
                        key={m.userId}
                        title={m.displayName ?? m.username}
                        className="-ml-1 rounded-full ring-2 ring-void first:ml-0"
                      >
                        <Avatar
                          avatarUrl={m.avatarUrl}
                          name={m.displayName ?? m.username}
                          size={15}
                        />
                      </span>
                    ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
