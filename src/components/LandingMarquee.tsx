import Link from "next/link";
import SpecimenCard from "./SpecimenCard";
import TiltCard from "./TiltCard";
import { APP_POSITIONING } from "@/lib/brand";
import { posterUrl } from "@/lib/tmdb-urls";
import type { WallPoster } from "@/lib/posters";

/**
 * The signed-out landing: the pitch as a title card.
 *
 * Three rules hold it together. The lettering is the structure rather than a
 * headline sitting on top of one, so scale carries the argument that a tenth
 * is a real distinction. The objects floating over it are the actual product —
 * a taste card and real posters — never invented members, because there are no
 * members yet. And the whole thing runs on the app's own graphite: someone who
 * signs up should arrive somewhere they recognise.
 *
 * Two hollow lines and one solid: "properly" is the claim, so it is the only
 * one filled. The depth is a real offset-and-blur shadow rather than the hard
 * block extrude the reference used, which belongs to a neobrutalist world and
 * would read as costume here.
 *
 * Server-rendered. The only motion is CSS.
 */
export default function LandingMarquee({ posters }: { posters: WallPoster[] }) {
  const cardSlots = posters.slice(0, 4).map((p) => p.posterPath);
  const wall = posters.slice(0, 12);

  // `.bleed` escapes the centred column's width, but `main` also pads 24px top
  // and (with no bottom nav for a signed-out visitor) 96px bottom, which left
  // a strip of page background between the nav and the hero. Cancelling both
  // lets the hero meet the nav's rule and the wall meet the footer.
  return (
    <div className="bleed -mt-6 -mb-24 sm:-mb-6">
      <section className="relative overflow-hidden border-b border-seam bg-void px-4 pb-14 pt-10 sm:pb-20 sm:pt-16">
        {/* A projection grid, kept far quieter than the reference's: it should
            register as a surface the light falls on, not as a pattern. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.55] [background-image:linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] [background-size:5rem_5rem]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-[radial-gradient(70%_100%_at_50%_0%,rgba(143,174,204,.10),transparent_70%)]"
        />

        <div className="relative mx-auto w-full max-w-6xl">
          {/* The objects. From lg they are anchored to this block rather than
              offset by a guessed distance, so they hold their relationship to
              the lettering at any viewport height. Below lg they fall into
              normal flow underneath, where nothing can sit on the type. */}
          <div className="pointer-events-none absolute inset-0 z-20 hidden lg:block">
            <div className="marquee-settle pointer-events-auto absolute right-0 top-[2%] rotate-[6deg]">
              {/* The specimen is the only object on the page, so it is the one
                  thing worth making respond. SpecimenCard stays a server
                  component: it passes through as children. */}
              <TiltCard radius="20px">
                <SpecimenCard posterPaths={cardSlots} />
              </TiltCard>
            </div>
          </div>

          <Marquee />

          <div className="relative mt-9 flex flex-col items-start gap-6 sm:mt-12 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[38ch]">
              <p className="text-base leading-relaxed text-ash">
                <span className="text-paper">{APP_POSITIONING}</span>{" "}
                A film diary on a 1.0 to 10.0 scale, in tenths. Forty films don&apos;t share
                four stars here.{" "}
                <span className="num text-paper">8.7</span> and{" "}
                <span className="num text-paper">8.2</span> are different opinions.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href="/signup"
                  className="display rounded-card bg-paper px-6 py-3 text-[15px] font-medium text-carbon transition-colors hover:bg-white"
                >
                  Create account
                </Link>
                <Link href="/login" className="text-[15px] text-ash transition-colors hover:text-paper">
                  Sign in
                </Link>
              </div>
            </div>

            <StartBadge />
          </div>
        </div>

        {/* Below lg the card sits under the pitch, at full size and upright:
            small screens have no room beside the lettering, and a shrunken
            tilted card would sell the object short. */}
        <div className="relative mt-12 flex justify-center lg:hidden">
          <div className="marquee-settle">
            <SpecimenCard posterPaths={cardSlots} />
          </div>
        </div>
      </section>

      <PosterWall posters={wall} />
    </div>
  );
}

/**
 * The lettering. Sized in `vw` so it fills the viewport at every width rather
 * than stepping between breakpoints, and clamped at both ends so it neither
 * wraps on a narrow phone nor runs away on an ultrawide.
 */
function Marquee() {
  const shared =
    "display block font-bold uppercase leading-[0.82] [letter-spacing:-0.04em] [text-shadow:0_18px_44px_rgba(0,0,0,.75)]";
  const hollow =
    "text-transparent [-webkit-text-stroke:1.5px_#4a4a55] sm:[-webkit-text-stroke:2px_#55555f]";

  return (
    <h1 className="relative z-10 select-none">
      <span className="sr-only">Rate films properly.</span>

      <span aria-hidden className="block">
        <span
          className={`marquee-line ${shared} ${hollow} text-[clamp(3.4rem,11.5vw,148px)]`}
        >
          Rate
        </span>
        <span
          className={`marquee-line ${shared} ${hollow} -mt-[0.06em] pl-[6%] text-[clamp(3.4rem,11.5vw,148px)] sm:pl-[14%]`}
          style={{ animationDelay: "70ms" }}
        >
          Films
        </span>
        <span
          className={`marquee-line ${shared} -mt-[0.04em] text-[clamp(3.9rem,13.5vw,182px)] text-paper`}
          style={{ animationDelay: "140ms" }}
        >
          Properly<span className="text-gold">.</span>
        </span>
      </span>
    </h1>
  );
}

/**
 * The rotating ring. Continuous like the foil, so it belongs to the object
 * rather than to the page's entrance — the entrance is one moment and the
 * lettering owns it.
 */
function StartBadge() {
  return (
    <Link
      href="/signup"
      aria-label="Create account and start your diary"
      className="group relative hidden size-[132px] shrink-0 items-center justify-center rounded-full border border-seam bg-carbon transition-colors hover:border-gold/60 sm:flex"
    >
      <span aria-hidden className="marquee-ring absolute inset-0">
        <svg viewBox="0 0 100 100" className="size-full">
          <defs>
            <path
              id="badge-ring"
              d="M 50,50 m -34,0 a 34,34 0 1,1 68,0 a 34,34 0 1,1 -68,0"
              fill="none"
            />
          </defs>
          <text
            className="display text-[9.5px] uppercase"
            fill="#d9b25f"
            letterSpacing="2.2"
          >
            <textPath href="#badge-ring" startOffset="0%">
              Start your diary · Start your diary ·
            </textPath>
          </text>
        </svg>
      </span>

      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="size-6 text-paper transition-transform duration-300 group-hover:translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    </Link>
  );
}

/**
 * The close: the wall runs edge to edge and the promises sit on it.
 *
 * No rating chips. The community mean behind them is built from a handful of
 * accounts right now, and a number that thin printed at this size would claim
 * more than it knows.
 */
function PosterWall({ posters }: { posters: WallPoster[] }) {
  const PROMISES: { lead: string; rest: string }[] = [
    { lead: "Bring the history you already have.", rest: "Import, preview every row, undo anytime." },
    { lead: "Keep your history honest.", rest: "Rewatches never overwrite old ratings." },
    { lead: "Your data stays yours.", rest: "Full export, free forever." },
  ];

  return (
    <section className="relative overflow-hidden bg-void">
      {posters.length > 0 && (
        <div aria-hidden className="absolute inset-0">
          <div className="flex h-full">
            {posters.map((p, i) => {
              const url = posterUrl(p.posterPath, "w342");
              return (
                <span key={i} className="h-full min-w-0 flex-1 bg-tray">
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" className="size-full object-cover" />
                  )}
                </span>
              );
            })}
          </div>
          <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(14,14,16,.82)_0%,rgba(14,14,16,.93)_55%,#0e0e10_100%)]" />
        </div>
      )}

      <div className="relative mx-auto w-full max-w-5xl px-4 py-14 sm:py-20">
        <h2 className="display max-w-[20ch] text-[26px] leading-[1.1] text-paper sm:text-[32px]">
          The record you would defend years from now.
        </h2>
        <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <li key={p.lead} className="border-t border-seam pt-4 text-sm leading-relaxed">
              <span className="block text-paper">{p.lead}</span>
              <span className="mt-1 block text-ash">{p.rest}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
