import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { films, listItems, listMembers, lists, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { roleIn, type ListRole } from "@/lib/lists";
import { getRankedLibrary } from "@/lib/library";
import { avatarSrc } from "@/lib/avatar";
import ListDetail from "@/components/ListDetail";

export default async function ListPage(ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const list = (await db.select().from(lists).where(eq(lists.id, id)).limit(1))[0];
  if (!list) notFound();
  const role = await roleIn(id, user.id);
  if (!role) notFound();

  const itemRows = await db
    .select({
      filmId: listItems.filmId,
      title: films.title,
      year: films.year,
      slug: films.slug,
      posterPath: films.posterPath,
      director: films.director,
      note: listItems.note,
      addedBy: listItems.addedBy,
      addedByName: users.displayName,
      addedByUsername: users.username,
      addedByAvatarUpdatedAt: users.avatarUpdatedAt,
    })
    .from(listItems)
    .innerJoin(films, eq(films.id, listItems.filmId))
    .leftJoin(users, eq(users.id, listItems.addedBy))
    .where(eq(listItems.listId, id))
    // the order people dragged into; untouched rows keep insertion order
    .orderBy(asc(listItems.position), asc(listItems.createdAt));
  const items = itemRows.map(({ addedByAvatarUpdatedAt, ...i }) => ({
    ...i,
    addedByAvatar: i.addedBy ? avatarSrc(i.addedBy, addedByAvatarUpdatedAt) : null,
  }));

  const members = (
    await db
      .select({
        userId: listMembers.userId,
        role: listMembers.role,
        username: users.username,
        displayName: users.displayName,
        avatarUpdatedAt: users.avatarUpdatedAt,
      })
      .from(listMembers)
      .innerJoin(users, eq(users.id, listMembers.userId))
      .where(eq(listMembers.listId, id))
  ).map(({ avatarUpdatedAt, ...m }) => ({
    ...m,
    avatarUrl: avatarSrc(m.userId, avatarUpdatedAt),
  }));

  // the viewer's own library is the source for bulk-add
  const library = await getRankedLibrary(user.id);

  return (
    <ListDetail
      list={{ id: list.id, title: list.title, description: list.description }}
      items={items}
      members={members}
      myRole={role as ListRole}
      myUserId={user.id}
      libraryFilms={library.map((f) => ({
        filmId: f.filmId,
        title: f.title,
        year: f.year,
        posterPath: f.posterPath,
        rating: f.rating,
      }))}
    />
  );
}
