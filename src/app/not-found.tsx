import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <h1 className="display text-2xl text-paper">Nothing here</h1>
      <p className="mt-3 text-sm text-ash">
        That page, film, or profile doesn&apos;t exist, or it&apos;s private.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-card border border-seam px-4 py-2 text-sm text-paper hover:bg-tray"
      >
        Go home
      </Link>
    </div>
  );
}
