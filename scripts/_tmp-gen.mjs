import "./load-env.mjs";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`
  select g.value gen, count(*)::int c,
         round(100.0*count(*)/(select count(*) from films where genres is not null),1) pct
  from films cross join lateral jsonb_array_elements_text(coalesce(genres,'[]'::jsonb)) g
  where genres is not null group by 1 order by c desc`;
console.log("how common each genre is in the catalogue:");
for (const r of rows) console.log(`  ${r.gen.padEnd(17)} ${String(r.pct).padStart(5)}%`);
