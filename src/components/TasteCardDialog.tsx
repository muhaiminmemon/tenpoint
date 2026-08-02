"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence } from "@/lib/usePresence";
import AutoHeight from "./AutoHeight";
import { useToast } from "./Toast";
import TasteCardFlip from "./TasteCardFlip";
import { BinderLink } from "./TasteCardBig";
import { formatTenths } from "@/lib/format";
import type { HomeTasteCardData } from "@/lib/taste";

type Tab = "Card" | "Traits" | "Share";
type ShareFmt = "story" | "square" | "wide";

const SHARE_FORMATS: { key: ShareFmt; label: string; aspect: string; caption: string }[] = [
  { key: "story", label: "Story 9:16", aspect: "9 / 16", caption: "1080 × 1920 · PNG" },
  { key: "square", label: "Square 1:1", aspect: "1 / 1", caption: "1080 × 1080 · PNG" },
  { key: "wide", label: "Wide 16:9", aspect: "16 / 9", caption: "1920 × 1080 · PNG" },
];

export default function TasteCardDialog({
  open,
  onClose,
  data,
  username,
  displayName,
  avatarUrl,
  memberNumber,
}: {
  open: boolean;
  onClose: () => void;
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  memberNumber: number;
}) {
  const { rendered, state } = usePresence(open, 180);
  const [tab, setTab] = useState<Tab>("Card");
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

  async function nativeShare() {
    const text = `${data.archetype ?? "My taste card"}: ${data.rated} films, ${
      data.mean !== null ? formatTenths(data.mean) : "—"
    } average.`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "My taste card", text, url: shareUrl });
      } catch {
        // cancelled — nothing to do
      }
      return;
    }
    await copyLink();
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
            <span className="display truncate text-[16px] text-paper">{displayName}</span>
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

        <div className="grid flex-1 gap-6 p-4 sm:grid-cols-[320px_1fr] sm:p-5">
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
            <div className="mx-auto mt-3 flex w-full max-w-[368px] gap-2 sm:max-w-[320px]">
              <button
                type="button"
                onClick={() => setFlipped((f) => !f)}
                className="flex-1 rounded-card border border-seam bg-tray py-2 text-[12.5px] text-ash hover:text-paper"
              >
                {flipped ? "Show front ⇄" : "Show back ⇄"}
              </button>
              <button
                type="button"
                onClick={nativeShare}
                className="display flex-1 rounded-card bg-paper py-2 text-[12.5px] font-medium text-carbon hover:bg-white"
              >
                Share
              </button>
            </div>
          </div>

          <div className="min-w-0">
            {/* Keyed on the tab so the panel replays its entrance, and wrapped
                so the dialog eases between the three heights instead of
                snapping to each one. */}
            <AutoHeight>
            <div key={tab} className="pop-in">
            {tab === "Card" && <CardTab data={data} />}
            {tab === "Traits" && <TraitsTab data={data} />}
            {tab === "Share" && (
              <ShareTab
                data={data}
                username={username}
                displayName={displayName}
                format={format}
                shareFmt={shareFmt}
                setShareFmt={setShareFmt}
                hideNums={hideNums}
                setHideNums={setHideNums}
                onCopy={copyLink}
                onShare={nativeShare}
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

function CardTab({ data }: { data: HomeTasteCardData }) {
  const next = data.milestones;
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
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {data.profStats.map((s) => (
            <div key={s.label} className="rounded-card border border-seam bg-lift px-2 py-2.5 text-center">
              <div className="num text-[17px] text-paper">{s.value}</div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[.1em] text-ash">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {next && (
        <div className="rounded-xl border border-seam bg-lift p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[.14em] text-ash">
              {data.tier.name} → {next.nextTier?.name}
            </span>
            <span className="num text-[11px] text-beam">{next.met} of 6 conditions</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {next.milestones.map((m) => (
              <div key={m.label} className="flex items-center gap-2.5 border-b border-[#1e1e24] py-1.5">
                <span
                  className={`num flex size-4 shrink-0 items-center justify-center rounded-[5px] border text-[9px] ${
                    m.met ? "border-gold bg-gold text-carbon" : "border-seam text-dim"
                  }`}
                >
                  {m.met ? "✓" : ""}
                </span>
                <span className={`flex-1 text-[12.5px] ${m.met ? "text-paper" : "text-dim"}`}>{m.label}</span>
                <span className={`num text-[10.5px] ${m.met ? "text-gold" : "text-[#5a5a62]"}`}>{m.detail}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-dim">
            {next.nextTier?.name} needs any three of six. The tier re-mints the moment a third one
            lands, whichever it is.
          </p>
        </div>
      )}

      <BinderLink />
    </div>
  );
}

function TraitsTab({ data }: { data: HomeTasteCardData }) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-[.14em] text-ash">
          Traits · {data.traitsHeldCount} held of {data.traitsTotal}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {data.traits.map((t) => (
          <div
            key={t.key}
            className={`rounded-card border px-3 py-2.5 ${
              t.held ? "border-[#3a3320] bg-[rgba(217,178,95,.05)]" : "border-[#232329] bg-transparent"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`display text-[13.5px] ${t.held ? "text-paper" : "text-dim"}`}>{t.name}</span>
              {t.held && <span className="text-[10px] uppercase tracking-[.08em] text-gold">Held</span>}
            </div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-dim">{t.cond}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShareTab({
  data,
  username,
  displayName,
  format,
  shareFmt,
  setShareFmt,
  hideNums,
  setHideNums,
  onCopy,
  onShare,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  format: (typeof SHARE_FORMATS)[number];
  shareFmt: ShareFmt;
  setShareFmt: (f: ShareFmt) => void;
  hideNums: boolean;
  setHideNums: (v: boolean) => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <div>
      <div className="flex gap-1.5">
        {SHARE_FORMATS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setShareFmt(f.key)}
            className={`flex-1 rounded-card py-1.5 text-[12px] ${
              f.key === shareFmt
                ? "bg-paper text-carbon"
                : "border border-seam bg-tray text-ash hover:text-paper"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div
        className="mx-auto mt-4 overflow-hidden rounded-xl border-[1.5px] border-transparent bg-[linear-gradient(158deg,#191922,#0d0d11)] shadow-[0_18px_44px_rgba(0,0,0,.55)] transition-[width] duration-300"
        style={{ width: format.key === "story" ? "196px" : format.key === "square" ? "268px" : "330px", aspectRatio: format.aspect }}
      >
        <div className="flex size-full flex-col p-3.5">
          <div className="flex items-start justify-between">
            <span className="display text-[11px] text-beam">@{username}</span>
            <span className="flex flex-col items-end gap-px">
              <span className="text-[8px] uppercase tracking-[.2em]" style={{ color: data.tier.labelColor }}>
                ◆ {data.tier.name}
              </span>
              <span className="display text-[9px] uppercase tracking-[.08em]" style={{ color: data.variant.accentColor }}>
                {data.variant.name}
              </span>
            </span>
          </div>
          <div className="mt-auto">
            <div className="text-[8px] uppercase tracking-[.16em] text-[#8a8a92]">Archetype</div>
            <div className="display mt-0.5 text-[16px] leading-tight text-paper">{data.archetype ?? displayName}</div>
            <div className="num mt-1 text-[9px] text-[#c9b48a]">{data.traitsHeldCount} traits held</div>
            <div className="mt-2 flex items-end justify-between">
              <span className="text-[9px] text-ash">tenpoint.site/{username}</span>
              <span
                className="num text-[22px] leading-none text-paper transition-all"
                style={{ opacity: hideNums ? 0.14 : 1, filter: hideNums ? "blur(7px)" : "none" }}
              >
                {data.mean !== null ? formatTenths(data.mean) : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="num mt-2 text-center text-[10px] uppercase tracking-[.1em] text-dim">{format.caption}</div>

      <button
        type="button"
        onClick={() => setHideNums(!hideNums)}
        className="mt-3.5 flex w-full items-center justify-between gap-2.5 rounded-card border border-seam px-3 py-2.5 text-left"
      >
        <span>
          <span className="block text-[13px] text-paper">Hide my numbers</span>
          <span className="mt-0.5 block text-[11px] text-ash">Shares the class and the reel, not the average.</span>
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

      <div className="mt-1 flex flex-col">
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-3 border-t border-[#1e1e24] py-2.5 text-left hover:bg-[#16161a]"
        >
          <span className="num w-5 text-center text-[13px] text-beam">⧉</span>
          <span className="flex-1 text-[13px] text-paper">Copy card link</span>
        </button>
        <button
          type="button"
          onClick={onShare}
          className="flex items-center gap-3 border-t border-[#1e1e24] py-2.5 text-left hover:bg-[#16161a]"
        >
          <span className="num w-5 text-center text-[13px] text-beam">↗</span>
          <span className="flex-1 text-[13px] text-paper">Share…</span>
        </button>
      </div>
    </div>
  );
}
