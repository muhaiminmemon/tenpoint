import Link from "next/link";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-seam">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ash">
        <span className="flex items-center gap-3">
          <span>
            {APP_NAME}, {APP_TAGLINE.charAt(0).toLowerCase() + APP_TAGLINE.slice(1)}
          </span>
          <Link href="/privacy" className="underline hover:text-paper">
            Privacy
          </Link>
          <Link href="/terms" className="underline hover:text-paper">
            Terms
          </Link>
        </span>
        <span>
          Film data from{" "}
          <a
            href="https://www.themoviedb.org"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-paper"
          >
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </span>
      </div>
    </footer>
  );
}
