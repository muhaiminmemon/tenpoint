/**
 * Applies pending migrations from ./drizzle.
 *
 * This replaces `drizzle-kit push`. Push diffs the schema file against the
 * live database and alters it to match, which is fine on an empty dev database
 * and destructive once real rows exist: a renamed column reads as a drop plus
 * an add, and the data goes with it. Migrations are reviewable files that run
 * once, in order, and record what has already been applied.
 */
import "./load-env.mjs";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

// `max: 1` because migrations must run in a single sequential session.
const sql = postgres(url, { max: 1 });

try {
  // pg_trgm backs the fuzzy title and username search, and has to exist before
  // any migration that creates an index using it.
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
