/**
 * The taste card before a single film is rated — a blank negative, not yet
 * exposed. Same slot the developing and foil cards will occupy later, so the
 * homepage never re-lays-out as someone's history grows.
 */
export default function TasteCardBlank() {
  return (
    <div className="rounded-xl border border-seam bg-carbon p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-ash">Your taste card</p>
      <div
        aria-hidden
        className="relative mt-3 overflow-hidden rounded-lg border border-dashed border-seam"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, #131317 0, #131317 7px, #16161a 7px, #16161a 14px)",
        }}
      >
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <span className="display text-2xl text-seam">?</span>
          <span className="max-w-[220px] text-xs leading-relaxed text-dim">
            Rate your first film to expose it: your average, your favourite decade, the genres
            you keep coming back to.
          </span>
        </div>
      </div>
    </div>
  );
}
