import { formatTenths } from "@/lib/format";

/** Ten CSS bars, 1–10. No chart library, no interaction beyond a tooltip. */
export default function RatingHistogram({ ratings }: { ratings: number[] }) {
  if (ratings.length < 3) return null;

  const buckets = Array.from({ length: 10 }, () => 0);
  for (const r of ratings) {
    const b = Math.min(9, Math.max(0, Math.floor(r / 10) - 1));
    buckets[b]++;
  }
  const max = Math.max(...buckets);
  const mean = ratings.reduce((s, r) => s + r, 0) / ratings.length;

  return (
    <div className="flex items-end gap-3">
      <div
        role="img"
        aria-label={`Rating distribution across ${ratings.length} films, average ${formatTenths(Math.round(mean))}`}
        className="flex h-10 items-end gap-[3px]"
      >
        {buckets.map((count, i) => (
          <div
            key={i}
            title={`${i + 1}.0–${i + 1}.9 · ${count} ${count === 1 ? "title" : "titles"}`}
            className="w-2.5 rounded-t-[2px] bg-seam transition-colors hover:bg-ash"
            style={{ height: `${max ? Math.max(count / max, count > 0 ? 0.08 : 0) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="num pb-0.5 text-xs text-ash">
        <span className="text-paper">{formatTenths(Math.round(mean))}</span> avg
      </div>
    </div>
  );
}
