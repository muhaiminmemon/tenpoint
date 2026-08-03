import Link from "next/link";
import { posterUrl } from "@/lib/tmdb-urls";
import { APP_POSITIONING } from "@/lib/brand";
import type { WallPoster } from "@/lib/posters";

type Props = {
  mode: "login" | "signup";
  posters: WallPoster[];
  children: React.ReactNode;
};

/**
 * The split screen both auth pages sit in: the pitch and a poster wall on one
 * side, a calm form on the other. The wall drops away on narrow screens so the
 * form gets the whole width.
 */
export default function AuthShell({ mode, posters, children }: Props) {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="grid overflow-hidden rounded-xl border border-seam bg-carbon md:grid-cols-2">
        <aside className="relative hidden overflow-hidden border-r border-seam bg-[#0f0f12] p-8 md:block">
          {/* No kicker over the heading. The positioning line says the same
              thing the heading does and saying it twice, once in small caps,
              makes the heading look like it needed an introduction. */}
          <h2 className="display text-[30px] font-medium leading-[1.05] text-paper">
            {APP_POSITIONING} Your film cabinet, kept honest.
          </h2>
          <p className="mt-3.5 max-w-[280px] text-sm text-ash">
            Ratings in tenths, rewatch history that never lies, and taste you can compare with a
            friend.
          </p>
          {posters.length > 0 && (
            <div aria-hidden className="mt-7 grid grid-cols-4 gap-[7px] opacity-50">
              {posters.slice(0, 8).map((p, i) => {
                const url = posterUrl(p.posterPath, "w154");
                return url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={url}
                    alt={p.title}
                    loading="lazy"
                    className="w-full rounded-[4px] border border-seam bg-tray object-cover"
                    style={{ aspectRatio: "2/3" }}
                  />
                ) : (
                  <span
                    key={i}
                    className="w-full rounded-[4px] border border-seam bg-tray"
                    style={{ aspectRatio: "2/3" }}
                  />
                );
              })}
            </div>
          )}
        </aside>

        <div className="p-7 sm:p-8">
          {/* one control, two routes: never a dead end */}
          <div
            className="mb-5 flex w-fit overflow-hidden rounded-card border border-seam text-[13px]"
            role="group"
            aria-label="Sign in or create an account"
          >
            <Link
              href="/login"
              aria-current={mode === "login" ? "page" : undefined}
              className={`px-4 py-1.5 transition-colors ${
                mode === "login" ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
              }`}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              aria-current={mode === "signup" ? "page" : undefined}
              className={`px-4 py-1.5 transition-colors ${
                mode === "signup" ? "bg-tray-2 text-paper" : "text-ash hover:text-paper"
              }`}
            >
              Create account
            </Link>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
