// Builds a demo account with the deepest library the local catalogue allows,
// so the top of the rank ladder can actually be looked at.
//
// Depth is what the tier reads: a film is 1 point, a season is 4, finishing a
// series season by season is 2 more (capped at 50), and a title returned to is
// 1 (capped at 25). That means the ceiling is a property of the catalogue, not
// of how hard somebody tries — see the summary this prints at the end.
//
// Idempotent: re-running wipes the demo account's diary and rebuilds it, so it
// tracks the catalogue as the catalogue grows.
//
// The password is generated and printed once, never written down here. A
// literal default in this file is a credential committed to the repository,
// which is what it looks like to a secret scanner because that is what it is:
// anybody reading the source would know how to sign in as the demo account on
// any deployment that ran this.
//
// Usage:
//   npx tsx scripts/seed-toptier-demo.ts
//   npx tsx scripts/seed-toptier-demo.ts --username mythicdemo
//   DEMO_PASSWORD=... npx tsx scripts/seed-toptier-demo.ts   # to choose one
//
// Reads DATABASE_URL from .env.local.

import "./load-env.mjs";
import { randomBytes } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { users, films, diaryEntries } from "../src/db/schema";
import { hashPassword } from "../src/lib/auth";
import { syncUserTier } from "../src/lib/taste";
import { getTasteSignals } from "../src/lib/taste-card-signals";
import { libraryDepth, tierStanding, RARITY_TIERS } from "../src/lib/taste-card";

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback);
};

async function main() {
  const username = arg("username", "topdemo");
  // Taken from the environment if somebody wants a specific one, otherwise
  // fresh every run. Not a CLI flag: an argument lands in shell history.
  const password = process.env.DEMO_PASSWORD || randomBytes(12).toString("base64url");
  const email = `${username}@example.invalid`;

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.username, username));
  let userId = existing[0]?.id;

  if (userId) {
    await db.delete(diaryEntries).where(eq(diaryEntries.userId, userId));
    await db
      .update(users)
      .set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
      .where(eq(users.id, userId));
    console.log(`reusing @${username}, diary cleared`);
  } else {
    const [row] = await db
      .insert(users)
      .values({
        username,
        displayName: "Top Tier Demo",
        email,
        passwordHash: await hashPassword(password),
        // Verified outright: this account exists to be logged into, and no
        // mail is configured locally.
        emailVerifiedAt: new Date(),
        privacy: "public",
      })
      .returning({ id: users.id });
    userId = row.id;
    console.log(`created @${username}`);
  }

  // Everything the catalogue holds. Seasons are the valuable rows at 4 points
  // each, but films and whole-series rows are free points on top.
  const catalogue = await db
    .select({ id: films.id, kind: films.kind })
    .from(films)
    .where(inArray(films.kind, ["movie", "season", "show"]));

  /**
   * Spread across six years, and dated.
   *
   * The card's finish now weights recent viewing more heavily, so a library
   * stamped with one date would carry no recency signal at all and the demo
   * would not exercise the thing it is meant to show.
   */
  const today = Date.now();
  const values = catalogue.map((f, i) => ({
    userId: userId!,
    filmId: f.id,
    rating: 50 + ((i * 7) % 51),
    watchedOn: new Date(today - ((i * 3) % 2190) * 86_400_000).toISOString().slice(0, 10),
    private: false,
  }));

  for (let i = 0; i < values.length; i += 500) {
    await db.insert(diaryEntries).values(values.slice(i, i + 500));
  }

  // A handful of titles returned to, for the rewatch line of the ladder.
  const repeats = catalogue.slice(0, 25).map((f, i) => ({
    userId: userId!,
    filmId: f.id,
    rating: 70 + i,
    watchedOn: new Date(today - i * 86_400_000).toISOString().slice(0, 10),
    rewatch: true,
    private: false,
  }));
  await db.insert(diaryEntries).values(repeats);

  await syncUserTier(userId);

  const signals = await getTasteSignals(userId, { includePrivate: true });
  const depth = libraryDepth(signals);
  const standing = tierStanding(signals);
  const mythic = RARITY_TIERS[RARITY_TIERS.length - 1];

  console.log(`\n@${username} / ${password}`);
  console.log(`${values.length} titles rated, ${repeats.length} returned to`);
  console.log(`\nlibrary depth ${depth.depth}`);
  for (const line of depth.lines) {
    console.log(`  ${String(line.count).padStart(4)} ${line.label.padEnd(30)} x${line.per} = ${line.points}${line.capped ? " (capped)" : ""}`);
  }
  console.log(`\ntier: ${standing.tier.name}`);
  if (standing.tier.name !== mythic.name) {
    console.log(
      `${mythic.name} needs ${mythic.depth}; this catalogue tops out at ${depth.depth}. ` +
        `Short by ${mythic.depth - depth.depth} — the ceiling is the size of the local film table, not the account.`,
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
