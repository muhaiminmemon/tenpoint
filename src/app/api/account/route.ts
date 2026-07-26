import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listMembers, lists, users } from "@/db/schema";
import { destroySession, getSessionUser, verifyPassword } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  password: z.string().min(1),
  /** Typing the username is the "are you sure" — a dialog alone is too easy. */
  confirmUsername: z.string().min(1),
});

/**
 * Deletes the account and everything it owns.
 *
 * The heavy lifting is done by `on delete cascade` on every table that
 * references `users.id`, so this can't drift out of sync with the schema the
 * way an explicit delete-in-order would. The one thing cascade gets wrong is
 * shared lists, handled below.
 */
export async function DELETE(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "account-delete", LIMITS.auth, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  if (parsed.data.confirmUsername.trim().toLowerCase() !== user.username) {
    return NextResponse.json(
      { error: "Type your username exactly to confirm." },
      { status: 400 },
    );
  }

  const row = (
    await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1)
  )[0];
  if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }

  /*
   * A list this user owns would cascade away and take other people's
   * collaborative work with it. Hand each one to another member first,
   * preferring someone who was already writing to it, and only let it be
   * deleted if they were genuinely the only person on it.
   */
  const owned = await db
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.ownerId, user.id));

  for (const list of owned) {
    const heir = (
      await db
        .select({ userId: listMembers.userId, role: listMembers.role })
        .from(listMembers)
        .where(and(eq(listMembers.listId, list.id), ne(listMembers.userId, user.id)))
        // 'editor' sorts before 'viewer', so the list keeps a writer if it has one
        .orderBy(listMembers.role)
        .limit(1)
    )[0];
    if (!heir) continue;

    await db.update(lists).set({ ownerId: heir.userId }).where(eq(lists.id, list.id));
    await db
      .update(listMembers)
      .set({ role: "owner" })
      .where(and(eq(listMembers.listId, list.id), eq(listMembers.userId, heir.userId)));
  }

  await db.delete(users).where(eq(users.id, user.id));
  await destroySession();

  return NextResponse.json({ ok: true });
}
