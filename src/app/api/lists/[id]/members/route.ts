import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { listMembers, safeUserColumns, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { roleIn } from "@/lib/lists";
import { isBlockedBetween } from "@/lib/social";

const addSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["editor", "viewer"]),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  if ((await roleIn(id, user.id)) !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage members." }, { status: 403 });
  }
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const member = (
    await db
      .select(safeUserColumns)
      .from(users)
      .where(eq(users.username, parsed.data.username.toLowerCase()))
      .limit(1)
  )[0];
  if (!member || (await isBlockedBetween(user.id, member.id))) {
    return NextResponse.json({ error: "No user with that username." }, { status: 404 });
  }

  await db
    .insert(listMembers)
    .values({ listId: id, userId: member.id, role: parsed.data.role })
    .onConflictDoUpdate({
      target: [listMembers.listId, listMembers.userId],
      set: { role: parsed.data.role },
    });
  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ userId: z.string().uuid() });

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = removeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });

  const myRole = await roleIn(id, user.id);
  const removingSelf = parsed.data.userId === user.id;
  if (myRole !== "owner" && !removingSelf) {
    return NextResponse.json({ error: "Only the owner can manage members." }, { status: 403 });
  }
  if (myRole === "owner" && removingSelf) {
    return NextResponse.json(
      { error: "Owners can't leave their own list. Delete it instead." },
      { status: 400 },
    );
  }

  await db
    .delete(listMembers)
    .where(and(eq(listMembers.listId, id), eq(listMembers.userId, parsed.data.userId)));
  return NextResponse.json({ ok: true });
}
