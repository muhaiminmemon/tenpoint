import { NextResponse } from "next/server";
import { db } from "@/db";
import { imports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { parseLetterboxdCsv } from "@/lib/letterboxd";
import { parseMalXml } from "@/lib/myanimelist";
import { filmKey, type ImportPayload } from "@/lib/importer";

/**
 * A Letterboxd export is a handful of small CSVs; a decade of daily logging is
 * well under a megabyte. These bounds exist because `file.text()` pulls the
 * whole upload into memory and the parse is then stored as a jsonb column, so
 * an unbounded upload is both an OOM and a way to bloat the database.
 */
const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 50_000;

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const limited = enforceRateLimit(req, "import-parse", LIMITS.imports, user.id);
  if (limited) return limited;

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Choose at least one file: a Letterboxd CSV or a MyAnimeList XML." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Upload at most ${MAX_FILES} files at once.` },
      { status: 400 },
    );
  }

  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
  if (tooBig || totalBytes > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "That's larger than a diary export should ever be. Check the files." },
      { status: 413 },
    );
  }

  const payload: ImportPayload = { rows: [], matches: {} };
  const filenames: string[] = [];
  const unrecognized: string[] = [];

  for (const file of files) {
    const text = await file.text();

    /**
     * An anime export, which arrives already resolved.
     *
     * MyAnimeList files each season of a series separately with its own score,
     * and the shipped mapping turns its ids straight into a TMDB show and a
     * season number. That is a better answer than the title search could ever
     * give, so those rows are matched here rather than left to the match step:
     * "Shingeki no Kyojin" searched as a title finds a film, four seasons, or
     * nothing, and never reliably the third season somebody scored.
     */
    const anime = parseMalXml(text);
    if (anime) {
      const offset = payload.rows.length;
      for (const [i, r] of anime.rows.entries()) {
        const row = { ...r, key: `${r.kind}:${offset + i}` };
        payload.rows.push(row);
        if (r.tmdbId !== null) {
          payload.matches[filmKey(row)] = {
            tmdbId: r.tmdbId,
            title: r.name,
            year: r.year,
            posterPath: null,
            season: r.season,
          };
        }
      }
      filenames.push(file.name);
      continue;
    }

    const parsed = parseLetterboxdCsv(text, file.name);
    if (!parsed) {
      unrecognized.push(file.name);
      continue;
    }
    // re-key rows so multiple files of the same kind can't collide
    const offset = payload.rows.length;
    payload.rows.push(
      ...parsed.rows.map((r, i) => ({ ...r, key: `${r.kind}:${offset + i}` })),
    );
    filenames.push(file.name);
  }

  if (payload.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: `That's over ${MAX_ROWS.toLocaleString()} rows. Split the export and try again.` },
      { status: 413 },
    );
  }

  if (!payload.rows.length) {
    return NextResponse.json(
      {
        error: unrecognized.length
          ? `Couldn't read ${unrecognized.join(", ")}. Upload ratings.csv from Letterboxd, or the XML from MyAnimeList.`
          : "Those files contained no film rows.",
      },
      { status: 400 },
    );
  }

  const created = await db
    .insert(imports)
    .values({ userId: user.id, filenames, payload })
    .returning({ id: imports.id });

  return NextResponse.json({
    importId: created[0].id,
    rows: payload.rows,
    unrecognized,
  });
}
