import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { listMembers, lists } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";

const schema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "list-create", LIMITS.write, user.id);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Give the list a title." }, { status: 400 });

  const created = await db
    .insert(lists)
    .values({
      ownerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
    })
    .returning();
  await db
    .insert(listMembers)
    .values({ listId: created[0].id, userId: user.id, role: "owner" });

  return NextResponse.json({ list: created[0] });
}
