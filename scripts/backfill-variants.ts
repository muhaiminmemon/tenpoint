// Credits every account with the finishes its library has already earned.
//
// Two rules changed under the binder at once. The stock a card is printed on
// used to be an argmax over the whole library, so a shelf concentrated in one
// theme was issued one finish on its first hundred films and could never be
// issued another; and only that printed finish was ever written to
// `held_variants`, so the table could not grow past a single row however much
// somebody watched. Both are fixed going forward, but `held_variants` is only
// written on the owner's own visit, so without this every existing account
// waits until its next page load to be credited for watching it already did.
//
// Runs the real `computeVariant` rather than a second copy of the rule in SQL.
// It costs one signals query per user, which is the same query the home page
// runs, so a few hundred accounts is a few seconds.
//
// Idempotent: `recordHeldVariants` conflicts on (user, finish) and never moves
// `first_held_at`, so re-running credits nothing twice and rewrites no dates.
//
// Usage:
//   npx tsx scripts/backfill-variants.ts            # every account
//   npx tsx scripts/backfill-variants.ts --dry-run  # report, write nothing
//   npx tsx scripts/backfill-variants.ts --limit 50
//
// Reads DATABASE_URL from .env.local.

import "./load-env.mjs";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { getTasteSignals } from "../src/lib/taste-card-signals";
import { getTasteProfile } from "../src/lib/taste";
import { computeVariant } from "../src/lib/taste-card";
import { getHeldVariantNames, recordHeldVariants } from "../src/lib/variant-history";

const flag = (name: string) => process.argv.includes(`--${name}`);
const arg = (name: string, fallback: number | null): number | null => {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const n = Number.parseInt(process.argv[i + 1] ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
};

async function main() {
  const dryRun = flag("dry-run");
  const limit = arg("limit", null);

  const rows = await db.select({ id: users.id, username: users.username }).from(users);
  const list = limit === null ? rows : rows.slice(0, limit);

  console.log(`${list.length} account${list.length === 1 ? "" : "s"}${dryRun ? " (dry run)" : ""}`);

  let credited = 0;
  let usersTouched = 0;
  let skipped = 0;

  for (const user of list) {
    /**
     * The owner's own reading, private viewings included.
     *
     * A finish is earned by watching, not by publishing: crediting the public
     * reading would quietly refuse somebody the stock their private diary
     * plainly earned, and the home page already writes the private reading.
     */
    const taste = await getTasteProfile(user.id, { includePrivate: true });
    if (taste.rated === 0) {
      skipped++;
      continue;
    }

    const signals = await getTasteSignals(user.id, { includePrivate: true });
    const variant = computeVariant(
      signals,
      taste.topGenres[0]?.name,
      signals.topRatedDecade,
      taste.topDecade?.decade ?? null,
      taste.mean,
    );

    const already = await getHeldVariantNames(user.id);
    const missing = variant.held.filter((name) => name && !already.has(name));
    if (missing.length === 0) continue;

    if (!dryRun) await recordHeldVariants(user.id, missing);
    credited += missing.length;
    usersTouched++;
    console.log(`  @${user.username}: +${missing.join(", +")}`);
  }

  console.log(
    `${dryRun ? "would credit" : "credited"} ${credited} finish${credited === 1 ? "" : "es"} across ${usersTouched} account${usersTouched === 1 ? "" : "s"}; ${skipped} with nothing rated`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
