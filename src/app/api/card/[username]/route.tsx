import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { avatarSrc } from "@/lib/avatar";
import { publicOrigin } from "@/lib/http";
import { canViewProfile, friendIdsOf, isBlockedBetween } from "@/lib/social";
import { getRankedLibrary } from "@/lib/library";
import { buildHomeTasteCard, getTasteProfile } from "@/lib/taste";
import { formatTenths } from "@/lib/format";
import { stockDef } from "@/lib/taste-card";
import { TMDB_IMAGE_BASE } from "@/lib/tmdb-urls";
import { SHARE_SIZES, type ShareFmt } from "@/lib/share-card";
import type { HomeTasteCardData } from "@/lib/taste";

/**
 * The taste card as an actual image.
 *
 * Sharing used to send a link to a profile, which is a different object: the
 * person receiving it saw a web page, not the card, and only if they followed
 * it. What people want to post is the card. So it is drawn here, server side,
 * at full resolution, from the same data and the same materials the card on
 * screen is made of: the tier's rim, the stock's ground, the same type, the
 * same four posters.
 *
 * Drawn rather than screenshotted because a screenshot of a web page is at the
 * mercy of whatever the device did to it. This composition is fixed, so every
 * card that goes out looks like the card.
 */
export const runtime = "nodejs";

const FONT_DIR = path.join(process.cwd(), "src/fonts");
let fonts: { name: string; data: ArrayBuffer; weight: 400 | 500 | 700; style: "normal" }[] | null =
  null;

async function loadFonts() {
  if (fonts) return fonts;
  const read = async (file: string) => {
    const buf = await readFile(path.join(FONT_DIR, file));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };
  fonts = [
    { name: "Grotesk", data: await read("SpaceGrotesk-Medium.ttf"), weight: 500, style: "normal" },
    { name: "Grotesk", data: await read("SpaceGrotesk-Bold.ttf"), weight: 700, style: "normal" },
    { name: "Plex", data: await read("IBMPlexSans-Regular.ttf"), weight: 400, style: "normal" },
  ];
  return fonts;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const url = new URL(req.url);
  const fmtRaw = url.searchParams.get("fmt");
  const fmt: ShareFmt = fmtRaw === "square" || fmtRaw === "wide" ? fmtRaw : "story";
  const hideNums = url.searchParams.get("hide") === "1";

  const profile = (
    await db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1)
  )[0];
  if (!profile) return new Response("Not found", { status: 404 });

  // The same gates the profile page applies. An image endpoint that skipped
  // them would be a way to read a private account by asking for a picture of
  // it instead of the page.
  const viewer = await getSessionUser();
  const isOwner = viewer?.id === profile.id;
  if (viewer && !isOwner && (await isBlockedBetween(viewer.id, profile.id))) {
    return new Response("Not found", { status: 404 });
  }
  if (!(await canViewProfile(viewer, profile))) {
    return new Response("Not found", { status: 404 });
  }

  const taste = await getTasteProfile(profile.id, { includePrivate: isOwner });
  if (taste.rated === 0) return new Response("No card yet", { status: 404 });

  // Seasons, not series: the card weighs a season as a season, and the shared
  // image has to be the same card the owner sees at home.
  const library = await getRankedLibrary(profile.id, {
    includePrivate: isOwner,
    collapseSeries: false,
  });
  const data = await buildHomeTasteCard(
    profile.id,
    taste,
    library,
    await friendIdsOf(profile.id),
    { includePrivate: isOwner },
  );

  const size = SHARE_SIZES[fmt];
  const fonts = await loadFonts();
  const avatarUrl = (() => {
    const rel = avatarSrc(profile.id, profile.avatarUpdatedAt);
    // Satori fetches images itself, so a site-relative path is not something
    // it can resolve.
    return rel ? `${publicOrigin(req)}${rel}` : null;
  })();

  /**
   * Drawn to a buffer rather than streamed, so a failure can be caught.
   *
   * Satori fetches every remote image itself and throws when one will not
   * load, and that happens while the response is streaming: constructing the
   * ImageResponse succeeds and the error arrives later, where nothing can
   * catch it. The panel asking for the image then waits for a body that never
   * comes, which is the card that "keeps drawing".
   *
   * Reading it here forces the render inside a try, at the cost of holding one
   * PNG in memory.
   */
  const draw = async (withImages: boolean) => {
    const res = new ImageResponse(
      (
        <Poster
          data={data}
          username={profile.username}
          displayName={profile.displayName ?? profile.username}
          memberSince={profile.createdAt?.getFullYear() ?? new Date().getFullYear()}
          fmt={fmt}
          hideNums={hideNums}
          withImages={withImages}
        />
      ),
      { ...size, fonts },
    );
    return Buffer.from(await res.arrayBuffer());
  };

  let png: Buffer;
  try {
    png = await draw(true);
  } catch {
    // One poster that will not load should cost the posters, not the card.
    try {
      png = await draw(false);
    } catch (e) {
      // Surfaced rather than swallowed: a card that will not draw at all is a
      // bug in the composition, and "could not draw this card" told nobody
      // which one or why.
      console.error(`share card failed for ${profile.username}:`, e);
      return new Response("Could not draw this card", { status: 500 });
    }
  }

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Private to the person who asked: the same URL renders different things
      // for an owner and a stranger.
      "Cache-Control": "private, max-age=60",
      "Content-Disposition": `inline; filename="${profile.username}-taste-card.png"`,
    },
  });
}

/** The card, scaled to fill whichever canvas was asked for. */
function Poster({
  data,
  username,
  displayName,
  memberSince,
  fmt,
  hideNums,
  withImages = true,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  memberSince: number;
  fmt: ShareFmt;
  hideNums: boolean;
  /** false on the retry after a remote image refused to load */
  withImages?: boolean;
}) {
  const { tier, variant } = data;
  const stock = stockDef(variant.stock);
  const size = SHARE_SIZES[fmt];
  const ground = stock?.material ?? "linear-gradient(158deg,#18181e,#0f0f13)";
  const chips = (
    data.themeDNA.length > 0
      ? data.themeDNA
      : data.genreShare.map((g) => ({ ...g, lift: 0 }))
  )
    .slice(0, 3)
    .sort((a, b) => b.pct - a.pct);

  /**
   * One card, drawn twice.
   *
   * This image and the card on the homepage are two renderers of the same
   * object, and they had drifted into two different designs: the score sat
   * top-right here and centre there, the archetype was set in Grotesk here and
   * in the serif there, the themes were still pills here after the card on
   * screen had moved to a proportional band, and the handle was blue here after
   * the card on screen had gone white. Somebody sharing their card was posting
   * a picture of a card nobody has.
   *
   * So the layout below is `TasteCardFace` line for line, in the same order,
   * with `u()` converting that component's pixel sizes onto this canvas: the
   * face is authored against a 320px-wide card, so `u(n) = n * cardW / 320`
   * reproduces its proportions at any share size. Change one, change both.
   */
  const cardW = fmt === "story" ? 880 : fmt === "square" ? 700 : 620;
  const u = (n: number) => Math.round((n * cardW) / 320);
  const PAPER = "#eceae6";
  const CARD_2 = "rgba(236,234,230,.78)";
  const CARD_3 = "rgba(236,234,230,.62)";
  // `ratingColor` returns a Tailwind class; this canvas needs the value behind it.
  const scoreColor =
    data.mean === null ? CARD_2 : data.mean >= 90 ? "#d9b25f" : data.mean >= 70 ? PAPER : "#9a9aa3";
  const filled =
    data.mean === null ? 0 : Math.max(1, Math.min(5, Math.round(data.mean / 20)));
  const parts = (data.archetype ?? "").trim().split(/\s+/).filter(Boolean);
  const qualifier = parts.length > 1 ? parts[0] : "";
  const archetypeName = parts.length > 1 ? parts.slice(1).join(" ") : parts[0] ?? displayName;
  const bandInk = ["rgba(236,234,230,.55)", "rgba(236,234,230,.35)", "rgba(236,234,230,.2)"];

  return (
    <div
      style={{
        width: size.width,
        height: size.height,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0e0e10",
        fontFamily: "Plex",
        position: "relative",
      }}
    >
      {/* The tier's own glow, as the light in the room rather than a shadow on
          the card. It covers the whole canvas: a gradient inside a smaller box
          shows its own edges as a rectangle of slightly lighter ground. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          background: `radial-gradient(closest-side, ${tier.labelColor}1c, rgba(14,14,16,0) 78%)`,
          display: "flex",
        }}
      />

      {/* The rim is the tier, exactly as on screen: 2px of metal at 320px wide. */}
      <div
        style={{
          width: cardW,
          display: "flex",
          padding: u(2),
          background: tier.borderFlat ?? tier.border,
          position: "relative",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            background: ground,
            padding: `${u(18)}px ${u(16)}px ${u(16)}px`,
            position: "relative",
          }}
        >
          {/* The foil, as the still frame of the sweep the live card animates. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(112deg, rgba(255,255,255,0) 28%, rgba(255,255,255,.09) 44%," +
                " rgba(255,255,255,.16) 50%, rgba(255,255,255,.07) 57%, rgba(255,255,255,0) 74%)",
              display: "flex",
            }}
          />

          {/* handle / since */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span
              style={{
                fontFamily: "Grotesk",
                fontSize: u(9),
                letterSpacing: u(9) * 0.06,
                textTransform: "uppercase",
                color: CARD_2,
              }}
            >
              @{username}
            </span>
            <span
              style={{
                fontFamily: "Grotesk",
                fontSize: u(9),
                letterSpacing: u(9) * 0.14,
                textTransform: "uppercase",
                color: CARD_3,
              }}
            >
              Since {memberSince}
            </span>
          </div>

          {/* archetype: the tracked qualifier, then the name */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: u(14),
            }}
          >
            {qualifier && (
              <span
                style={{
                  fontSize: u(13),
                  letterSpacing: u(13) * 0.2,
                  textTransform: "uppercase",
                  color: PAPER,
                  lineHeight: 1.1,
                }}
              >
                {qualifier}
              </span>
            )}
            <span
              style={{
                fontFamily: "Serif",
                fontStyle: "italic",
                fontSize: u(38),
                lineHeight: 0.95,
                letterSpacing: u(38) * -0.01,
                color: PAPER,
                marginTop: qualifier ? u(5) : 0,
                textAlign: "center",
              }}
            >
              {archetypeName}
            </span>
          </div>

          {/* taste class */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              gap: u(7),
              marginTop: u(9),
            }}
          >
            <span
              style={{
                fontSize: u(9),
                letterSpacing: u(9) * 0.16,
                textTransform: "uppercase",
                color: CARD_2,
              }}
            >
              Taste class
            </span>
            {variant.name && (
              <span
                style={{
                  fontFamily: "Grotesk",
                  fontSize: u(9),
                  letterSpacing: u(9) * 0.16,
                  textTransform: "uppercase",
                  color: variant.accentColor,
                }}
              >
                {variant.name}
              </span>
            )}
          </div>

          {/* the score leads; stars and tier demote beneath it, no rule */}
          {data.mean !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: u(6),
                marginTop: u(16),
              }}
            >
              <span
                style={{
                  fontFamily: "Grotesk",
                  fontSize: u(30),
                  lineHeight: 1,
                  color: scoreColor,
                  opacity: hideNums ? 0.12 : 1,
                }}
              >
                {formatTenths(data.mean)}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: u(8) }}>
                <Stars filled={filled} size={u(10)} />
                <span
                  style={{
                    fontSize: u(9),
                    letterSpacing: u(9) * 0.1,
                    textTransform: "uppercase",
                    color: tier.labelColor,
                  }}
                >
                  {tier.name}
                </span>
              </div>
            </div>
          )}

          {/* themes as proportion, not as pills */}
          {chips.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: u(8), marginTop: u(14) }}>
              <div
                style={{
                  display: "flex",
                  width: "100%",
                  height: u(3),
                  borderRadius: u(2),
                  overflow: "hidden",
                }}
              >
                {chips.map((g, i) => (
                  <div
                    key={g.name}
                    style={{ display: "flex", flexGrow: g.pct, background: bandInk[i] ?? bandInk[2] }}
                  />
                ))}
              </div>
              {/* One third each, centred, name over figure — the same rule the
                  face uses, so a long set of theme names cannot jam one edge
                  here while wrapping neatly on screen. */}
              <div style={{ display: "flex", gap: u(8) }}>
                {chips.map((g) => (
                  <div
                    key={g.name}
                    style={{
                      display: "flex",
                      flex: 1,
                      flexDirection: "column",
                      alignItems: "center",
                      fontSize: u(9),
                      letterSpacing: u(9) * 0.1,
                      textTransform: "uppercase",
                      color: CARD_2,
                    }}
                  >
                    <span>{g.name}</span>
                    <span style={{ fontFamily: "Grotesk", color: CARD_3 }}>{g.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {withImages && data.signatureFilms.length > 0 && (
            <div style={{ display: "flex", gap: u(4), marginTop: u(14) }}>
              {data.signatureFilms.slice(0, 4).map((f) => {
                const w = Math.round((cardW - u(32) - u(12)) / 4);
                return (
                  <div
                    key={f.slug}
                    style={{
                      width: w,
                      height: Math.round(w * 1.5),
                      display: "flex",
                      borderRadius: u(4),
                      overflow: "hidden",
                      background: "#1c1c21",
                    }}
                  >
                    {f.posterPath && (
                      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                      <img
                        src={`${TMDB_IMAGE_BASE}/w342${f.posterPath}`}
                        width={w}
                        height={Math.round(w * 1.5)}
                        style={{ objectFit: "cover" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {data.traitsHeldCount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: u(10),
                marginTop: u(12),
                fontSize: u(10),
              }}
            >
              <span style={{ fontFamily: "Grotesk", color: "#d9b25f" }}>
                {data.traitsHeldCount} traits
              </span>
              {data.mix.shows > 0 && (
                <span style={{ fontFamily: "Grotesk", color: CARD_3 }}>
                  {data.mix.showShare}% series
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <span
        style={{
          fontFamily: "Grotesk",
          fontSize: u(9),
          letterSpacing: u(9) * 0.4,
          textTransform: "uppercase",
          color: "#71717a",
          marginTop: u(19),
        }}
      >
        Tenpoint
      </span>
    </div>
  );
}

/** Five stars, drawn rather than typed: no font here carries the glyph. */
function Stars({ filled, size }: { filled: number; size: number }) {
  return (
    <div style={{ display: "flex", gap: Math.round(size * 0.18) }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <path
            d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.35 6.2 20.4l1.1-6.45-4.7-4.6 6.5-.95z"
            fill={i < filled ? "#d9b25f" : "rgba(255,255,255,.13)"}
          />
        </svg>
      ))}
    </div>
  );
}

