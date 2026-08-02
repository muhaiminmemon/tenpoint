import "./load-env.mjs";
import postgres from "postgres";
import { readFileSync } from "node:fs";
const KW = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-muhaimin-Repos-tenpoint/9690024a-1af8-479b-b176-70553e5ea5e3/scratchpad/cl.json","utf8"));
const P={caped:.165,hearth:.15,dissident:.133,void:.115,revenge:.109,myth:.105,machine:.102,grief:.102,noir:.099,road:.096,slasher:.091,identity:.091,comingofage:.09,investigation:.087,blade:.087,ink:.087,war:.085,period:.082,deadpan:.081,creature:.078,apocalypse:.076,romance:.075,occult:.069,spy:.067,prison:.066,loop:.063,body:.063,ghost:.063,alien:.061,sport:.06,satire:.057,stage:.052,sea:.052,winterholiday:.051,heist:.048,truestory:.042,flight:.036,outsider:.034,undead:.031,faith:.031,speed:.03,town:.021,court:.013};
const MAP = JSON.parse(process.argv[2]);
const stockOf = {}; for (const [s, ks] of Object.entries(MAP)) for (const k of ks) stockOf[k]=s;
const sql = postgres(process.env.DATABASE_URL);
const films = (await sql`select keywords, genres from films where jsonb_typeof(keywords)='array' and jsonb_array_length(keywords)>0`)
  .map(f=>({kw:new Set(f.keywords.map(k=>k.toLowerCase())), genres:f.genres||[]}));
await sql.end();
const GEN=[...new Set(films.flatMap(f=>f.genres))];
let seed=2024; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
const stocks={}, winners={};
for (let i=0;i<1500;i++){
  const favour=GEN[Math.floor(rnd()*GEN.length)], lib=[]; let g=0;
  const n=25+Math.floor(rnd()*180);
  while(lib.length<n && g++<n*40){const f=films[Math.floor(rnd()*films.length)];
    if(!f.genres.includes(favour)&&rnd()<0.6) continue; lib.push(f);}
  if(lib.length<25) continue;
  const counts={};
  for(const f of lib) for(const [k,kws] of Object.entries(KW)) if(kws.some(x=>f.kw.has(x))) counts[k]=(counts[k]||0)+1;
  const floor=Math.max(4, Math.round(lib.length*0.02));
  const sig=Object.entries(counts).filter(([,c])=>c>=floor)
    .map(([k,c])=>({k,c,lift:c/lib.length/(P[k]||0.05)})).sort((a,b)=>b.lift-a.lift);
  const win=sig[0]?.k;
  const st= win ? (stockOf[win]||"Bare") : "Bare";
  stocks[st]=(stocks[st]||0)+1; if(win) winners[win]=(winners[win]||0)+1;
}
const tot=Object.values(stocks).reduce((a,b)=>a+b,0);
console.log(`${tot} libraries\n`);
for(const [k,v] of Object.entries(stocks).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(11)} ${(v/tot*100).toFixed(1)}%`);
const w=Object.entries(winners).sort((a,b)=>b[1]-a[1]);
console.log(`\n${w.length} clusters win at least once. top: ${w.slice(0,8).map(([k,v])=>k+" "+(v/tot*100).toFixed(0)+"%").join(", ")}`);
