import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { comments, diaryEntries, films, reports, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import ReportQueue, { type ReportRow } from "@/components/ReportQueue";

/** Per-viewer for the same reason as the dashboard: a static title leaks. */
export async function generateMetadata() {
  const viewer = await getSessionUser();
  return { title: isAdmin(viewer) ? "Reports" : "Not found" };
}

export default async function AdminReportsPage() {
  const viewer = await getSessionUser();
  // 404 rather than 403: an unauthorised visitor learns nothing about whether
  // this route exists.
  if (!isAdmin(viewer)) notFound();

  const reporter = users;
  const rows = await db
    .select({
      id: reports.id,
      subjectType: reports.subjectType,
      subjectId: reports.subjectId,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      reporterUsername: reporter.username,
    })
    .from(reports)
    .leftJoin(reporter, eq(reporter.id, reports.reporterId))
    // Open first, then newest. Ordering on `status` directly would sort
    // alphabetically and bury the open ones between dismissed and resolved.
    .orderBy(sql`case when ${reports.status} = 'open' then 0 else 1 end`, desc(reports.createdAt))
    .limit(200);

  /*
   * `reports.subjectId` is a loose text id, not a foreign key, so the reported
   * row may already be deleted. These two lookups fill in what still exists;
   * anything missing renders as "no longer exists" rather than breaking.
   */
  const reviewIds = rows.filter((r) => r.subjectType === "review").map((r) => r.subjectId);
  const commentIds = rows.filter((r) => r.subjectType === "comment").map((r) => r.subjectId);

  const reviewRows = reviewIds.length
    ? await db
        .select({
          id: diaryEntries.id,
          review: diaryEntries.review,
          author: users.username,
          filmSlug: films.slug,
        })
        .from(diaryEntries)
        .innerJoin(users, eq(users.id, diaryEntries.userId))
        .innerJoin(films, eq(films.id, diaryEntries.filmId))
        .where(inArray(diaryEntries.id, reviewIds))
    : [];

  const commentRows = commentIds.length
    ? await db
        .select({ id: comments.id, body: comments.body, author: users.username })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.userId))
        .where(inArray(comments.id, commentIds))
    : [];

  const reviewById = new Map(reviewRows.map((r) => [r.id, r]));
  const commentById = new Map(commentRows.map((c) => [c.id, c]));

  const queue: ReportRow[] = rows.map((r) => {
    const review = r.subjectType === "review" ? reviewById.get(r.subjectId) : undefined;
    const comment = r.subjectType === "comment" ? commentById.get(r.subjectId) : undefined;
    return {
      ...r,
      subjectText: review?.review ?? comment?.body ?? null,
      subjectAuthor: review?.author ?? comment?.author ?? null,
      subjectFilmSlug: review?.filmSlug ?? null,
    };
  });

  const open = queue.filter((r) => r.status === "open").length;

  return (
    <div className="max-w-2xl">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="display text-2xl">Reports</h1>
        <Link href="/admin" className="text-sm text-ash underline hover:text-paper">
          Dashboard
        </Link>
      </div>
      <p className="num mb-6 text-sm text-ash">
        {open} open · {queue.length} total
      </p>
      <ReportQueue reports={queue} />
    </div>
  );
}
