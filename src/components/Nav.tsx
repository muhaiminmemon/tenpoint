import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { APP_SLUG } from "@/lib/brand";
import { isAdmin } from "@/lib/admin";
import SignOutButton from "./SignOutButton";
import NavLinks from "./NavLinks";
import Avatar from "./Avatar";
import CommandPalette from "./CommandPalette";
import BottomNav from "./BottomNav";
import VerifyBanner from "./VerifyBanner";

export default async function Nav() {
  const user = await getSessionUser();

  return (
    <>
      <header className="border-b border-seam">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link
            href={user ? "/library" : "/"}
            className="flex shrink-0 items-center gap-2 display text-lg font-medium tracking-tight"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, not an optimizable remote image */}
            <img src="/brand/mark.png" alt="" width={22} height={22} className="rounded-[5px]" />
            {APP_SLUG}
          </Link>
          {user ? (
            <>
              {/* the full link set needs room; phones get the bottom bar instead */}
              <div className="hidden sm:block">
                <NavLinks />
              </div>
              <div className="ml-auto flex items-center gap-3">
                <CommandPalette />
                {/* Only rendered for the handful of usernames in
                    ADMIN_USERNAMES; everyone else never learns it exists. */}
                {isAdmin(user) && (
                  <Link
                    href="/admin"
                    className="hidden text-sm text-ash hover:text-paper sm:inline"
                  >
                    Admin
                  </Link>
                )}
                <Link
                  href="/settings"
                  className="hidden text-sm text-ash hover:text-paper sm:inline"
                >
                  Settings
                </Link>
                <div className="hidden sm:block">
                  <SignOutButton />
                </div>
                <Link
                  href={`/${user.username}`}
                  title="Your profile"
                  aria-label="Your profile"
                  className="shrink-0"
                >
                  <Avatar
                    avatarUrl={avatarSrc(user.id, user.avatarUpdatedAt)}
                    name={user.displayName ?? user.username}
                    size={28}
                  />
                </Link>
              </div>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-4 text-sm">
              <Link href="/login" className="text-ash hover:text-paper">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-card bg-paper px-3 py-1.5 font-medium text-carbon hover:bg-white"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </header>
      {user && !user.emailVerifiedAt && <VerifyBanner email={user.email} />}
      {user && <BottomNav />}
    </>
  );
}
