import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getSessionUser } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { formatTenths } from "@/lib/format";
import { avatarSrc } from "@/lib/avatar";
import Avatar from "@/components/Avatar";

/**
 * The title is resolved per-viewer rather than exported statically. A static
 * `metadata` export is evaluated even when the page itself calls `notFound()`,
 * so the 404 shipped to a stranger still carried the word "Dashboard" in its
 * <title> — confirming the route exists, which is the one thing the 404 was
 * chosen to avoid. `getSessionUser` is request-cached, so this costs nothing.
 */
export async function generateMetadata() {
  const viewer = await getSessionUser();
  return { title: isAdmin(viewer) ? "Dashboard" : "Not found" };
}

// Always fresh: a monitoring page that can be served from a cache is telling
// you about a moment that has already passed.
export const dynamic = "force-dynamic";

type Totals = {
  total_users: number;
  verified: number;
  users_today: number;
  users_week: number;
};

type Activity = {
  total_entries: number;
  entries_today: number;
  entries_week: number;
  active_week: number;
  never_logged: number;
};

type SignupRow = {
  id: string;
  username: string;
  email: string;
  email_verified_at: string | null;
  avatar_updated_at: string | null;
  created_at: string;
  entries: number;
};

type FeedRow = {
  id: string;
  username: string;
  title: string;
  slug: string;
  year: number | null;
  rating: number | null;
  created_at: string;
};

type FilmRow = { title: string; slug: string; year: number | null; logs: number; watchers: number };

export default async function AdminDashboard() {
  const viewer = await getSessionUser();
  if (!viewer || !isAdmin(viewer)) notFound();

  /*
   * One pass per table rather than per statistic: `count(*) filter (where …)`
   * lets Postgres compute every window in a single scan, which keeps this page
   * one query per section instead of a dozen round trips.
   */
  const [totals] = (await db.execute(sql`
    select
      count(*)::int as total_users,
      count(*) filter (where email_verified_at is not null)::int as verified,
      count(*) filter (where created_at >= now() - interval '1 day')::int as users_today,
      count(*) filter (where created_at >= now() - interval '7 days')::int as users_week
    from users
  `)) as unknown as Totals[];

  const [activity] = (await db.execute(sql`
    select
      (select count(*) from diary_entries)::int as total_entries,
      (select count(*) from diary_entries where created_at >= now() - interval '1 day')::int as entries_today,
      (select count(*) from diary_entries where created_at >= now() - interval '7 days')::int as entries_week,
      (select count(distinct user_id) from diary_entries where created_at >= now() - interval '7 days')::int as active_week,
      (select count(*) from users u where not exists (
         select 1 from diary_entries d where d.user_id = u.id
       ))::int as never_logged
  `)) as unknown as Activity[];

  const [reports] = (await db.execute(sql`
    select count(*) filter (where status = 'open')::int as open
    from reports
  `)) as unknown as { open: number }[];

  const signups = (await db.execute(sql`
    select u.id, u.username, u.email, u.email_verified_at, u.avatar_updated_at,
           u.created_at, count(d.id)::int as entries
    from users u
    left join diary_entries d on d.user_id = u.id
    group by u.id
    order by u.created_at desc
    limit 20
  `)) as unknown as SignupRow[];

  /*
   * The activity feed excludes `private` entries. The privacy page promises
   * that a private entry is "yours alone", and an admin screen is exactly the
   * place that promise would quietly be broken. Aggregate counts above still
   * include them: a total reveals nothing about who watched what.
   */
  const feed = (await db.execute(sql`
    select d.id, u.username, f.title, f.slug, f.year, d.rating, d.created_at
    from diary_entries d
    join users u on u.id = d.user_id
    join films f on f.id = d.film_id
    where d.private = false
    order by d.created_at desc
    limit 20
  `)) as unknown as FeedRow[];

  const films = (await db.execute(sql`
    select f.title, f.slug, f.year,
           count(*)::int as logs,
           count(distinct d.user_id)::int as watchers
    from diary_entries d
    join films f on f.id = d.film_id
    group by f.id, f.title, f.slug, f.year
    order by logs desc, f.title asc
    limit 10
  `)) as unknown as FilmRow[];

  const unverified = totals.total_users - totals.verified;
  const verifiedPct =
    totals.total_users > 0 ? Math.round((totals.verified / totals.total_users) * 100) : 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="display text-2xl">Dashboard</h1>
        <Link href="/admin/reports" className="text-sm text-ash underline hover:text-paper">
          Reports{reports.open > 0 ? ` (${reports.open} open)` : ""}
        </Link>
      </div>

      <Section title="People">
        <Tiles>
          <Tile label="Total" value={totals.total_users} />
          <Tile label="Today" value={totals.users_today} />
          <Tile label="This week" value={totals.users_week} />
          <Tile
            label="Verified"
            value={`${verifiedPct}%`}
            // The number that tells you whether email is actually arriving.
            hint={unverified > 0 ? `${unverified} unverified` : "all confirmed"}
            warn={totals.total_users > 2 && verifiedPct < 60}
          />
        </Tiles>
        {totals.total_users > 2 && verifiedPct < 60 && (
          <p className="mt-3 text-xs text-warn">
            Most accounts never confirmed their address. That usually means verification mail is
            landing in spam rather than that people chose not to — check the Resend dashboard for
            delivered vs. bounced.
          </p>
        )}
      </Section>

      <Section title="Activity">
        <Tiles>
          <Tile label="Entries" value={activity.total_entries} />
          <Tile label="Today" value={activity.entries_today} />
          <Tile label="This week" value={activity.entries_week} />
          <Tile
            label="Active (7d)"
            value={activity.active_week}
            hint={`${activity.never_logged} never logged`}
          />
        </Tiles>
      </Section>

      <Section title="Recent signups">
        {signups.length === 0 ? (
          <Empty>Nobody yet.</Empty>
        ) : (
          <ul className="divide-y divide-seam">
            {signups.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <Avatar
                  avatarUrl={avatarSrc(s.id, s.avatar_updated_at)}
                  name={s.username}
                  size={26}
                />
                <div className="min-w-0 flex-1">
                  <Link href={`/${s.username}`} className="text-sm text-paper hover:underline">
                    {s.username}
                  </Link>
                  <span className="num ml-2 text-xs text-ash">
                    {new Date(s.created_at).toISOString().slice(0, 10)}
                  </span>
                </div>
                <span className="num text-xs text-ash">
                  {s.entries} {s.entries === 1 ? "entry" : "entries"}
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    s.email_verified_at
                      ? "border-seam text-ash"
                      : "border-warn/40 text-warn"
                  }`}
                >
                  {s.email_verified_at ? "verified" : "unverified"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Latest logs">
        {feed.length === 0 ? (
          <Empty>No films logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-seam">
            {feed.map((e) => (
              <li key={e.id} className="flex items-baseline gap-2 py-2 text-sm">
                <Link href={`/${e.username}`} className="text-paper hover:underline">
                  {e.username}
                </Link>
                <Link href={`/film/${e.slug}`} className="min-w-0 flex-1 truncate text-ash hover:underline">
                  {e.title} <span className="num">{e.year ?? ""}</span>
                </Link>
                <span className="num text-paper">
                  {e.rating !== null ? formatTenths(e.rating) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ash">
          Entries marked &quot;only me&quot; are excluded here, the same as everywhere else.
        </p>
      </Section>

      <Section title="Most logged films">
        {films.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <ul className="divide-y divide-seam">
            {films.map((f) => (
              <li key={f.slug} className="flex items-baseline gap-2 py-2 text-sm">
                <Link href={`/film/${f.slug}`} className="min-w-0 flex-1 truncate text-paper hover:underline">
                  {f.title} <span className="num text-ash">{f.year ?? ""}</span>
                </Link>
                <span className="num text-xs text-ash">
                  {f.logs} {f.logs === 1 ? "log" : "logs"} · {f.watchers}{" "}
                  {f.watchers === 1 ? "person" : "people"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="mb-3 text-sm uppercase tracking-wide text-ash">{title}</h2>
      {children}
    </section>
  );
}

function Tiles({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</div>;
}

function Tile({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: number | string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-card border border-seam bg-tray px-3 py-2.5">
      <div className={`num text-2xl ${warn ? "text-warn" : "text-paper"}`}>{value}</div>
      <div className="mt-0.5 text-xs text-ash">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-ash">{hint}</div>}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-ash">{children}</p>;
}
