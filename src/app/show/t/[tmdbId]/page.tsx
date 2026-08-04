import { notFound, redirect } from "next/navigation";
import { ensureShow } from "@/lib/shows";

/** Lands a TMDB series in the catalogue, seasons and all, then redirects to it. */
export default async function ShowByTmdbId(ctx: { params: Promise<{ tmdbId: string }> }) {
  const { tmdbId } = await ctx.params;
  const id = Number(tmdbId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const show = await ensureShow(id);
  if (!show) notFound();
  redirect(`/show/${show.slug}`);
}
