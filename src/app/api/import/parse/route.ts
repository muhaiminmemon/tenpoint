import { NextResponse } from "next/server";
import { db } from "@/db";
import { imports } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { enforceRateLimit, LIMITS } from "@/lib/ratelimit";
import { parseLetterboxdCsv } from "@/lib/letterboxd";
import type { ImportPayload } from "@/lib/importer";

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
    return NextResponse.json({ error: "Choose at least one CSV from your Letterboxd export." }, { status: 400 });
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
      { error: "That's larger than a Letterboxd export should ever be. Check the files." },
      { status: 413 },
    );
  }

  const payload: ImportPayload = { rows: [], matches: {} };
  const filenames: string[] = [];
  const unrecognized: string[] = [];

  for (const file of files) {
    const text = await file.text();
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
          ? `Couldn't read ${unrecognized.join(", ")}. Upload diary.csv, ratings.csv, watched.csv, or watchlist.csv from your Letterboxd export.`
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
