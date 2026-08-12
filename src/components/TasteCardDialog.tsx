"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowsLeftRight } from "@phosphor-icons/react/ssr";
import { usePresence } from "@/lib/usePresence";
import AutoHeight from "./AutoHeight";
import { useToast } from "./Toast";
import TasteCardFlip from "./TasteCardFlip";
import { BinderLink } from "./TasteCardBig";
import { SHARE_FORMATS, shareImageUrl, type ShareFmt } from "@/lib/share-card";
import type { HomeTasteCardData } from "@/lib/taste";

type Tab = "Card" | "Traits" | "Share";

export default function TasteCardDialog({
  open,
  onClose,
  initialTab = "Card",
  binderHref,
  data,
  username,
  displayName,
  avatarUrl,
  memberNumber,
}: {
  open: boolean;
  onClose: () => void;
  /** which panel to land on; "Share" when opened by a share button */
  initialTab?: Tab;
  /** whose binder the card links to; omitted on your own card */
  binderHref?: string;
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number;
}) {
  const { rendered, state } = usePresence(open, 180);
  const [tab, setTab] = useState<Tab>(initialTab);
  // Reopening from a different button lands on that button's panel rather than
  // wherever the last visit left off. Compared in state rather than a ref, so
  // nothing is read during render that React does not track.
  const [openedOn, setOpenedOn] = useState(initialTab);
  if (open && openedOn !== initialTab) {
    setOpenedOn(initialTab);
    setTab(initialTab);
  }
  const [flipped, setFlipped] = useState(false);
  const [shareFmt, setShareFmt] = useState<ShareFmt>("story");
  const [hideNums, setHideNums] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
      restoreFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!rendered) return null;
  const leaving = state === "out";

  const shareUrl = typeof window !== "undefined" ? `${location.origin}/${username}` : `/${username}`;
  const format = SHARE_FORMATS.find((f) => f.key === shareFmt)!;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ message: "Card link copied." });
    } catch {
      toast({ message: "Couldn't copy the link.", tone: "warn" });
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`${leaving ? "scrim-out" : "scrim-in"} absolute inset-0 w-full cursor-default bg-[rgba(8,8,10,.78)] backdrop-blur-[4px]`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${displayName}'s taste card`}
        tabIndex={-1}
        className={`${leaving ? "palette-out" : "palette-in"} absolute inset-0 flex flex-col overflow-y-auto bg-[#111114] outline-none sm:inset-x-0 sm:top-6 sm:bottom-auto sm:mx-auto sm:max-h-[calc(100vh-48px)] sm:w-[min(872px,calc(100%-48px))] sm:rounded-2xl sm:border sm:border-seam sm:shadow-[0_40px_110px_rgba(0,0,0,.7)]`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#232329] px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="display truncate text-[17px] text-paper">{displayName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="flex gap-0.5 rounded-[7px] border border-seam bg-[#1a1a1f] p-0.5">
              {(["Card", "Traits", "Share"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`rounded-[5px] px-3 py-1.5 text-[12px] ${
                    tab === t ? "bg-paper text-carbon" : "text-ash hover:text-paper"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-7 shrink-0 items-center justify-center rounded-card border border-seam text-ash hover:text-paper"
            >
              ×
            </button>
          </div>
        </div>

        {/* Shrinkable tracks. Below `sm` this is one implicit `auto` column,
            which sizes to the card's widest content and refuses to go under
            it, pushing the dialog wider than the phone holding it. */}
        <div className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-6 p-4 sm:grid-cols-[320px_minmax(0,1fr)] sm:p-5">
          <div>
            <TasteCardFlip
              data={data}
              username={username}
              displayName={displayName}
              avatarUrl={avatarUrl}
              memberNumber={memberNumber}
              flipped={flipped}
              onFlip={() => setFlipped((f) => !f)}
            />
            {/* Flipping only. Sharing lives in its own panel one row up, and
                two buttons for it put the same action in two places with two
                different meanings. */}
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="mx-auto mt-3 block w-full max-w-[368px] rounded-card border border-seam bg-tray py-2 text-[13px] text-ash hover:text-paper sm:max-w-[320px]"
            >
              <span className="flex items-center justify-center gap-1.5">
                {flipped ? "Show front" : "Show back"}
                <ArrowsLeftRight aria-hidden className="size-3.5" />
              </span>
            </button>
          </div>

          <div className="min-w-0">
            {/* Keyed on the tab so the panel replays its entrance, and wrapped
                so the dialog eases between the three heights instead of
                snapping to each one. */}
            <AutoHeight>
            <div key={tab} className="pop-in">
            {tab === "Card" && <CardTab data={data} binderHref={binderHref} />}
            {tab === "Traits" && <TraitsTab data={data} />}
            {tab === "Share" && (
              <ShareTab
                username={username}
                format={format}
                shareFmt={shareFmt}
                setShareFmt={setShareFmt}
                hideNums={hideNums}
                setHideNums={setHideNums}
                onCopy={copyLink}
              />
            )}
            </div>
            </AutoHeight>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardTab({ data, binderHref }: { data: HomeTasteCardData; binderHref?: string }) {
  const standing = data.standing;
  return (
    <div className="flex flex-col gap-5">
      {/* Beside the card from `sm`, where it reads as the caption to an object.
          Stacked under it on a phone it was the same two words a second time,
          directly below the card that had just said them. */}
      <div className="hidden items-baseline justify-between sm:flex">
        <div>
          <div className="text-[10px] uppercase tracking-[.14em] text-ash">Archetype</div>
          <div className="display mt-1 text-[20px] text-paper">{data.archetype ?? "Still developing"}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[.14em] text-ash">Variant</div>
          <div className="display mt-1 text-[15px]" style={{ color: data.variant.accentColor }}>
            {data.variant.name}
          </div>
        </div>
      </div>

      {data.profStats.length > 0 && (
        <div
          className={`grid grid-cols-3 gap-2 ${
            data.profStats.length >= 5 ? "sm:grid-cols-5" : "sm:grid-cols-4"
          }`}
        >
          {data.profStats.map((s) => (
            <div key={s.label} className="rounded-card border border-seam bg-lift px-2 py-2.5 text-center">
              <div className="num text-[17px] text-paper">{s.value}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[.1em] text-ash">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {standing?.gate && (
        <div className="rounded-xl border border-seam bg-lift p-4">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <span className="text-[10px] uppercase tracking-[.14em] text-ash">
              {data.tier.name} to {standing.next?.name}
            </span>
            <span className="num text-[11px] text-beam">
              {standing.depth.toLocaleString()} / {standing.gate.need.toLocaleString()}
            </span>
          </div>

          {/* The rung as a bar. Depth is one number, so this is one bar — the
              two stacked percentages that used to be here were describing a
              rule the ladder no longer uses. */}
          <div className="h-1 overflow-hidden rounded-full bg-dim">
            <span
              className="block h-full rounded-full bg-beam transition-[width] duration-500"
              style={{ width: `${standing.gate.progressPct}%` }}
            />
          </div>

          {/* Where the number came from, with the arithmetic left in. The point
              of one integer is that a reader can check it against their own
              diary, and they can only do that if both halves are printed. */}
          <dl className="mt-3">
            {standing.lines
              .filter((l) => l.points > 0)
              .map((l) => (
                <div
                  key={l.key}
                  className="flex items-baseline gap-2 border-t border-seam py-1 first:border-t-0"
                >
                  <dt className="num shrink-0 text-[11px] text-paper">
                    {l.count.toLocaleString()}
                  </dt>
                  <span className="min-w-0 flex-1 truncate text-[11px] text-ash">{l.label}</span>
                  <span className="num shrink-0 text-[11px] text-dim">
                    {l.capped ? "capped" : `× ${l.per}`}
                  </span>
                  <dd className="num w-12 shrink-0 text-right text-[11px] text-paper">
                    {l.points.toLocaleString()}
                  </dd>
                </div>
              ))}
            <div className="flex items-baseline gap-2 border-t border-edge pt-1.5">
              <span className="flex-1 text-[11px] uppercase tracking-[0.12em] text-ash">
                Library depth
              </span>
              <dd className="num w-12 shrink-0 text-right text-[13px] text-paper">
                {standing.depth.toLocaleString()}
              </dd>
            </div>
          </dl>

          <p className="mt-3 text-[12px] leading-relaxed text-dim">
            <span className="num text-ash">{standing.gate.toNext.toLocaleString()}</span> more
            points reaches {standing.next?.name}. Rank is how deep the library is and nothing
            else. It never changes your archetype, traits or signature titles.
          </p>
        </div>
      )}

      <BinderLink href={binderHref} label={binderHref ? "Open their binder" : undefined} />
    </div>
  );
}

function TraitsTab({ data }: { data: HomeTasteCardData }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[.14em] text-ash">
          Traits · {data.traitsHeldCount} held of {data.traitsTotal}
        </span>
      </div>
      <p className="mb-3 text-[11px] leading-snug text-dim">
        Every one of these is a count you can check against your own diary, and the bar is how far
        you are from the next mark.
      </p>
      {/* Every trait carries its own number. A badge that is only held or not
          stops moving the moment it is earned; a count keeps going, and the bar
          underneath is the distance to the next mark. The marks themselves stay
          out of the way: three of them shown as dots was a symbol the reader
          had to be taught, and the number plus the bar already say it. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.traits.map((t) => {
          const target = t.rungs[Math.min(2, t.level)];
          /**
           * Filled against the number the line underneath names, from zero.
           *
           * It used to measure across the current rung's band, which made the
           * bar disagree with its own caption twice over. Reaching a rung
           * exactly emptied it: nine films by one director read "5 more for
           * 14" above a bar at nothing, so earning a mark looked like losing
           * one. And two traits both saying "2 more for 10" drew at seventy
           * percent and twenty-eight, because they sat in bands of different
           * widths. Measuring from zero to the target makes the bar say what
           * the words say, and it only ever moves forward.
           */
          const pct = t.level >= 3 ? 100 : Math.min(100, (t.count / Math.max(1, target)) * 100);
          return (
            <div
              key={t.key}
              className={`rounded-card border px-3 py-2.5 ${
                t.held
                  ? "border-[#3a3320] bg-[rgba(217,178,95,.05)]"
                  : "border-[#232329] bg-transparent"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className={`display text-[13px] ${t.held ? "text-paper" : "text-dim"}`}>
                  {t.name}
                </span>
                {t.side === "show" && (
                  <span className="shrink-0 text-[9px] uppercase tracking-[.1em] text-dim">
                    Series
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-dim">
                <span className={t.held ? "num text-ash" : "num"}>{t.count}</span> {t.unit}
              </div>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-dim">
                <span
                  className="block h-full rounded-full bg-gold transition-[width] duration-500"
                  style={{ width: `${pct}%`, opacity: t.held ? 1 : 0.45 }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-dim">
                {t.toNext === null
                  ? "Every mark passed."
                  : `${t.toNext} more for ${target}.`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ShareTab({
  username,
  format,
  shareFmt,
  setShareFmt,
  hideNums,
  setHideNums,
  onCopy,
}: {
  username: string;
  format: (typeof SHARE_FORMATS)[number];
  shareFmt: ShareFmt;
  setShareFmt: (f: ShareFmt) => void;
  hideNums: boolean;
  setHideNums: (v: boolean) => void;
  onCopy: () => void;
}) {
  const { toast } = useToast();
  const src = shareImageUrl(username, shareFmt, hideNums);

  /**
   * The image itself, held ready before anybody presses anything.
   *
   * `navigator.share` has to be called from the gesture that asked for it, and
   * on iOS an await in between is enough to lose that permission. Fetching the
   * moment the format changes means the press has a file already in hand. The
   * preview above uses the same URL, so this is the browser cache, not a
   * second download.
   */
  // Stored with the URL it came from, so a format change invalidates it
  // without an extra render pass to clear it first.
  /**
   * Held with the URL it came from and with whether it failed.
   *
   * A failure used to be stored as "no file yet", which is the same state as
   * "still drawing", so anything that went wrong left the panel saying
   * "Drawing card…" for ever with the button disabled and no way to retry.
   * A card that cannot be drawn has to say so.
   */
  const [held, setHeld] = useState<{ src: string; file: File | null; failed: boolean }>({
    src,
    file: null,
    failed: false,
  });
  const [attempt, setAttempt] = useState(0);
  const current = held.src === src ? held : null;
  const file = current?.file ?? null;
  const failed = current?.failed ?? false;
  const loading = !file && !failed;

  useEffect(() => {
    let live = true;
    const timeout = AbortSignal.timeout(30_000);
    fetch(src, { signal: timeout })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        if (!live) return;
        setHeld({
          src,
          file: new File([blob], `${username}-taste-card.png`, { type: "image/png" }),
          failed: false,
        });
      })
      .catch(() => {
        if (live) setHeld({ src, file: null, failed: true });
      });
    return () => {
      live = false;
    };
  }, [src, username, attempt]);

  const canShareFile =
    typeof navigator !== "undefined" &&
    Boolean(file) &&
    Boolean(navigator.canShare?.({ files: [file as File] }));

  function download() {
    if (!file) return;
    const href = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = href;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(href);
    toast({ message: "Card saved." });
  }

  async function shareFile() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: "My taste card" });
    } catch {
      // cancelled, or refused mid-flight: the download is still there
    }
  }

  return (
    <div>
      <div className="flex gap-1.5">
        {SHARE_FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setShareFmt(f.key)}
            className={`flex-1 rounded-card py-1.5 text-[12px] transition-colors ${
              f.key === shareFmt
                ? "bg-paper text-carbon"
                : "border border-seam bg-tray text-ash hover:text-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* The preview is the file. Not a sketch of it, not a smaller version
          built from the same numbers: the same URL that gets shared, so what
          somebody looks at here is exactly what leaves. */}
      <div
        className="mx-auto mt-4 overflow-hidden rounded-xl border border-seam bg-[#0e0e10] shadow-[0_18px_44px_rgba(0,0,0,.55)] transition-[width,aspect-ratio] duration-300"
        style={{
          width: shareFmt === "story" ? "204px" : shareFmt === "square" ? "276px" : "336px",
          aspectRatio: format.aspect,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Your taste card, as it will be shared"
          className="size-full object-contain transition-opacity duration-300"
          style={{ opacity: loading ? 0.35 : 1 }}
        />
      </div>
      <div className="num mt-2 text-center text-[10px] uppercase tracking-[.1em] text-dim">
        {format.caption}
      </div>

      <button
        type="button"
        onClick={() => setHideNums(!hideNums)}
        className="mt-3.5 flex w-full items-center justify-between gap-2.5 rounded-card border border-seam px-3 py-2.5 text-left"
      >
        <span>
          <span className="block text-[13px] text-paper">Hide my numbers</span>
          <span className="mt-0.5 block text-[11px] text-ash">
            Shares the class and the reel, not the average.
          </span>
        </span>
        <span
          className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${hideNums ? "bg-beam" : "bg-seam"}`}
        >
          <span
            className="absolute top-0.5 size-3.5 rounded-full bg-paper transition-all"
            style={{ left: hideNums ? "17px" : "2px" }}
          />
        </span>
      </button>

      {failed && (
        <div className="mt-3 rounded-card border border-seam bg-[#1a1a1f] px-3 py-2.5">
          <p className="text-[12px] text-paper">That card wouldn&apos;t draw.</p>
          <p className="mt-0.5 text-[11px] leading-snug text-ash">
            Usually a poster that failed to load. Try again, or pick another size.
          </p>
          <button
            type="button"
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-2 rounded-card border border-seam px-3 py-1.5 text-[12px] text-paper transition-colors hover:border-dim"
          >
            Try again
          </button>
        </div>
      )}

      <div className={`mt-3 flex gap-2 ${failed ? "hidden" : ""}`}>
        {canShareFile && (
          <button
            type="button"
            onClick={shareFile}
            className="display flex-1 rounded-card bg-paper py-2.5 text-[13px] font-medium text-carbon transition-colors hover:bg-white"
          >
            Share image
          </button>
        )}
        <button
          type="button"
          onClick={download}
          disabled={!file}
          className={`${canShareFile ? "flex-1 border border-seam bg-tray text-ash hover:text-paper" : "display flex-1 bg-paper font-medium text-carbon hover:bg-white"} rounded-card py-2.5 text-[13px] transition-colors disabled:opacity-50`}
        >
          {loading ? "Drawing card…" : "Save image"}
        </button>
      </div>

      <button
        type="button"
        onClick={onCopy}
        className="mt-2 w-full py-2 text-[12px] text-ash transition-colors hover:text-paper"
      >
        Or copy a link to your profile
      </button>
    </div>
  );
}
