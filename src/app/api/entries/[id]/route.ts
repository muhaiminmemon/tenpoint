import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { diaryEntries } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { updateEntry } from "@/lib/entries";
import { revalidateAfterEntryChange } from "@/lib/revalidate";
import { syncUserTier } from "@/lib/taste";

const patchSchema = z.object({
  watchedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  rating: z.number().int().min(10).max(100).nullable().optional(),
  review: z.string().max(20000).nullable().optional(),
  spoiler: z.boolean().optional(),
  private: z.boolean().optional(),
  rewatch: z.boolean().optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (Object.values(parsed.data).every((v) => v === undefined)) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const result = await updateEntry(user.id, user.username, id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ entry: result.entry });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;

  const deleted = await db
    .delete(diaryEntries)
    .where(and(eq(diaryEntries.id, id), eq(diaryEntries.userId, user.id)))
    .returning({ id: diaryEntries.id });
  if (!deleted[0]) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  await syncUserTier(user.id);
  revalidateAfterEntryChange(user.username);
  return NextResponse.json({ ok: true });
}
