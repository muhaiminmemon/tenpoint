import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { APP_POSITIONING } from "@/lib/brand";
import { wallPosters } from "@/lib/posters";
import { formatTenths, ratingColor } from "@/lib/format";
import { posterUrl } from "@/lib/tmdb-urls";

const PROMISES: { lead: string; rest: string }[] = [
  {
    lead: "Bring your Letterboxd history.",
    rest: "Import, preview every row, undo anytime.",
  },
  {
    lead: "Keep your history honest.",
    rest: "Rewatches never overwrite old ratings.",
  },
  {
    lead: "Your data stays yours.",
    rest: "Full export, free forever.",
  },
];

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/library");

  const posters = await wallPosters(12);

  return (
    <div className="py-6">
      <div className="overflow-hidden rounded-xl border border-seam bg-carbon">
        <div className="grid md:grid-cols-[1fr_0.92fr]">
          <div className="p-8 sm:p-10 md:py-13">
            {/* The comparison lives in the copy, never in the name: describing
                what we're an alternative to is ordinary and protected, and
                naming ourselves after them would not have been. */}
            <p className="display mb-3 text-[13px] uppercase tracking-[0.14em] text-beam">
              {APP_POSITIONING}
            </p>
            <h1 className="display text-[38px] font-medium leading-[1.02] text-paper sm:text-[44px]">
              Rate films
              <br />
              properly.
            </h1>
            <p className="mt-5 max-w-[360px] text-base leading-relaxed text-ash">
              A film diary on a 1.0 to 10.0 scale, in tenths. Forty films don&apos;t share four
              stars here. <span className="num text-paper">8.7</span> and{" "}
              <span className="num text-paper">8.2</span> are different opinions.
            </p>

            <ul className="my-7 flex flex-col gap-3.5">
              {PROMISES.map((p) => (
                <li key={p.lead} className="text-sm">
                  <span className="text-paper">{p.lead}</span>{" "}
                  <span className="text-ash">{p.rest}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-4.5">
              <Link
                href="/signup"
                className="display rounded-card bg-paper px-5.5 py-2.5 text-[15px] font-medium text-carbon hover:bg-white"
              >
                Create account
              </Link>
              <Link href="/login" className="text-[15px] text-ash hover:text-paper">
                Sign in
              </Link>
            </div>
          </div>

          {/* the wall does the persuading; ratings shown are real community means */}
          {posters.length > 0 && (
            <div className="relative hidden overflow-hidden border-l border-seam bg-[#0f0f12] p-5.5 md:block">
              <h2 className="sr-only">The biggest films of {new Date().getFullYear()}</h2>
              <div className="grid grid-cols-4 gap-2">
                {posters.map((p, i) => {
                  const url = posterUrl(p.posterPath, "w154");
                  return (
                    <div
                      key={i}
                      className="relative overflow-hidden rounded-[5px] border border-seam bg-tray"
                      style={{ aspectRatio: "2/3" }}
                    >
                      {url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={url}
                          alt={p.title}
                          loading="lazy"
                          className="size-full object-cover"
                        />
                      )}
                      {p.rating !== null && (
                        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[rgba(10,10,12,.9)] to-transparent px-1.5 py-0.5">
                          <span className={`num text-[11px] ${ratingColor(p.rating)}`}>
                            {formatTenths(p.rating)}
                          </span>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0f0f12] to-transparent"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
