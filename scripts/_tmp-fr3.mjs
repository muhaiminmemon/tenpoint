import "./load-env.mjs";
import postgres from "postgres";
const sql = postgres(process.env.DATABASE_URL);
const a="2522aeb6-ea56-48f6-b56f-6db2a52da916", b="6e5c2772-d790-41fa-85af-b47f1b8d2dc5";
const [lo,hi] = a < b ? [a,b] : [b,a];
const existed = (await sql`select 1 from friendships where user_low_id=${lo} and user_high_id=${hi}`).length > 0;
if (!existed) await sql`insert into friendships (user_low_id,user_high_id) values (${lo},${hi})`;
console.log(existed ? "already friends" : "TEMP friendship added for the test");
await sql.end();
