import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { blocks, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import SettingsForm from "@/components/SettingsForm";
import BlockedList from "@/components/BlockedList";
import SignOutButton from "@/components/SignOutButton";
import PasswordChange from "@/components/PasswordChange";
import DeleteAccount from "@/components/DeleteAccount";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const blockedUsers = await db
    .select({ id: users.id, username: users.username, displayName: users.displayName })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, user.id));

  return (
    <div className="max-w-md">
      <h1 className="display mb-6 text-2xl">Settings</h1>
      <SettingsForm
        username={user.username}
        displayName={user.displayName}
        bio={user.bio}
        avatarUrl={avatarSrc(user.id, user.avatarUpdatedAt)}
        privacy={user.privacy as "public" | "friends" | "private"}
        commentPermission={user.commentPermission as "anyone" | "friends" | "off"}
        showDiaryOnProfile={user.showDiaryOnProfile}
        showWatchlistOnProfile={user.showWatchlistOnProfile}
      />
      <BlockedList blocked={blockedUsers} />
      <section className="mt-10 border-t border-seam pt-6">
        <h2 className="text-sm uppercase tracking-wide text-ash">Your data</h2>
        <p className="mt-2 text-sm text-ash">
          Everything you&apos;ve logged (diary, ratings, watchlist) in one file. Free forever.
        </p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
        <a
          href="/api/export"
          className="mt-3 inline-block rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
        >
          Export everything (JSON)
        </a>

        <h3 className="mt-8 text-sm text-paper">Take it to Letterboxd</h3>
        <p className="mt-1 text-sm text-ash">
          CSVs shaped for Letterboxd&apos;s importer. Their scale only goes to half stars, so
          ratings round to the nearest one: 8.7 becomes 4½★, 6.4 becomes 3★. Entries marked
          &quot;only me&quot; stay out of the file.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a
            href="/api/export?format=letterboxd"
            className="rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
          >
            Diary &amp; ratings (CSV)
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not navigation */}
          <a
            href="/api/export?format=letterboxd-watchlist"
            className="rounded-card border border-seam px-4 py-1.5 text-sm text-paper hover:bg-tray"
          >
            Watchlist (CSV)
          </a>
        </div>
        <p className="mt-2 text-xs text-ash">
          On Letterboxd: Settings → Import &amp; Export → Import Diary.
        </p>
      </section>

      <PasswordChange />

      {/* the nav's sign-out is desktop-only, so this is the way out on a phone */}
      <section className="mt-10 border-t border-seam pt-6">
        <SignOutButton />
      </section>

      <DeleteAccount username={user.username} />
    </div>
  );
}
