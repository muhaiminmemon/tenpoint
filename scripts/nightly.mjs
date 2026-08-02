// Everything the catalogue needs doing while nobody is looking.
//
// Three jobs that were being run by hand, which is how the catalogue ended up
// with credits on some films and not others, scores on a third of it, and a
// production database that had none of it for a day. Each one finds its own
// gaps and fills them, so this is safe to run every night forever and does
// nothing at all once the catalogue is complete.
//
// Order matters. Credits first, because the scores job needs an imdb_id and
// credits is what resolves it. Then embeddings, which read the keywords and
// cast credits fills in, and finally the similar lists, which read the
// embeddings.
//
// One job failing does not stop the others: a TMDB outage should not also cost
// the night's scores.
//
// Usage:
//   node scripts/nightly.mjs
//
// On Railway: add a Cron schedule of `0 4 * * *` with this as the command.

import { spawn } from "node:child_process";

const JOBS = [
  { name: "credits and keywords", args: ["scripts/backfill-credits.mjs"] },
  { name: "critic scores", args: ["scripts/backfill-scores.mjs", "--pages", "0"] },
  { name: "similarity map", args: ["scripts/backfill-embeddings.mjs"] },
  { name: "more like this", args: ["scripts/backfill-similar.mjs"] },
];

const run = (args) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });

const started = Date.now();
const failed = [];

for (const job of JOBS) {
  console.log(`\n=== ${job.name} ===`);
  const code = await run(job.args);
  if (code !== 0) {
    failed.push(job.name);
    console.error(`  ${job.name} exited ${code}, carrying on.`);
  }
}

const mins = ((Date.now() - started) / 60_000).toFixed(1);
if (failed.length === 0) {
  console.log(`\nAll ${JOBS.length} finished in ${mins} minutes.\n`);
} else {
  console.error(`\nFinished in ${mins} minutes. Failed: ${failed.join(", ")}.\n`);
  process.exitCode = 1;
}
