// Which words the archetype actually hands out, across every real library.
//
// The title picks the strongest reading, so a badly placed anchor does not
// merely mis-score one axis: it makes that axis beat every other one, and the
// same adjective lands on most of the service. This counts them.
import "./load-env.mjs";
import { db } from "../src/db";
import { users } from "../src/db/schema";
import { getTasteSignals } from "../src/lib/taste-card-signals";
import { readArchetype } from "../src/lib/taste-card";

async function main() {
  const all = await db.select({ id: users.id, username: users.username }).from(users);
  const counts = new Map<string, number>();
  let scored = 0;
  for (const u of all) {
    const signals = await getTasteSignals(u.id, { includePrivate: true });
    const a = readArchetype(undefined, [], signals);
    const word = a.title.replace(/^The\s+/, "").split(" ")[0];
    if (!word || word === "Unwritten") continue;
    scored++;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${scored} libraries with a reading, ${rows.length} distinct leading words\n`);
  for (const [word, n] of rows) {
    const pct = ((n / scored) * 100).toFixed(0);
    console.log(`   ${word.padEnd(16)} ${String(n).padStart(3)}  ${pct.padStart(3)}%  ${"#".repeat(n)}`);
  }
  const top = rows[0];
  console.log(`\n  most common leads ${((top[1] / scored) * 100).toFixed(0)}% of libraries\n`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
