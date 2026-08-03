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

  const library = await getRankedLibrary(profile.id, { includePrivate: isOwner });
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
          avatarUrl={withImages ? avatarUrl : null}
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
    } catch {
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
  avatarUrl,
  fmt,
  hideNums,
  withImages = true,
}: {
  data: HomeTasteCardData;
  username: string;
  displayName: string;
  memberSince: number;
  avatarUrl: string | null;
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

  // The card keeps its proportions on every canvas; only how much room is left
  // around it changes. A story has height to spare, a wide frame does not.
  //
  // Height is left to the content rather than fixed: a card padded out to a
  // chosen ratio ends in a band of empty ground under the posters, which is
  // the one thing the card on screen never does.
  const cardW = fmt === "story" ? 880 : fmt === "square" ? 700 : 620;
  const scale = cardW / 760;
  const px = (n: number) => Math.round(n * scale);

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

      <div
        style={{
          width: cardW,
          display: "flex",
          borderRadius: px(30),
          padding: px(3),
          background: tier.border,
          position: "relative",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderRadius: px(27),
            background: ground,
            padding: px(38),
            position: "relative",
          }}
        >
          {/* The foil, as the still frame of the sweep the live card animates. */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: px(27),
              background:
                "linear-gradient(112deg, rgba(255,255,255,0) 28%, rgba(255,255,255,.09) 44%," +
                " rgba(255,255,255,.16) 50%, rgba(255,255,255,.07) 57%, rgba(255,255,255,0) 74%)",
              display: "flex",
            }}
          />

          <Head
            username={username}
            displayName={displayName}
            memberSince={memberSince}
            avatarUrl={avatarUrl}
            data={data}
            hideNums={hideNums}
            px={px}
          />

          <div style={{ display: "flex", flexDirection: "column", marginTop: px(44) }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <span
                style={{
                  fontSize: px(19),
                  letterSpacing: px(3),
                  color: "#8a8a92",
                  textTransform: "uppercase",
                }}
              >
                Taste class
              </span>
              {variant.name && (
                <span
                  style={{
                    fontFamily: "Grotesk",
                    fontSize: px(18),
                    letterSpacing: px(1.4),
                    textTransform: "uppercase",
                    color: variant.accentColor,
                  }}
                >
                  {variant.name}
                </span>
              )}
            </div>
            <span
              style={{
                fontFamily: "Grotesk",
                fontWeight: 700,
                fontSize: px(56),
                lineHeight: 1.04,
                color: "#eceae6",
                marginTop: px(10),
                textAlign: "center",
              }}
            >
              {data.archetype ?? displayName}
            </span>
          </div>

          {chips.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: px(10), marginTop: px(26) }}>
              {chips.map((g) => (
                <div
                  key={g.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: px(9),
                    borderRadius: px(999),
                    border: "1px solid rgba(255,255,255,.1)",
                    background: "rgba(255,255,255,.04)",
                    padding: `${px(9)}px ${px(18)}px`,
                    fontSize: px(21),
                    color: "#eceae6",
                  }}
                >
                  {g.name}
                  <span style={{ fontFamily: "Grotesk", fontSize: px(18), color: "#8a8a92" }}>
                    {g.pct}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {withImages && data.signatureFilms.length > 0 && (
            <div style={{ display: "flex", gap: px(12), marginTop: px(30) }}>
              {data.signatureFilms.slice(0, 4).map((f) => {
                const w = Math.round((cardW - px(76) - px(36)) / 4);
                return (
                  <div
                    key={f.slug}
                    style={{
                      width: w,
                      height: Math.round(w * 1.5),
                      display: "flex",
                      borderRadius: px(9),
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,.08)",
                      background: "#1a1a1f",
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

          <div
            style={{
              display: "flex",
              marginTop: px(30),
              paddingTop: px(26),
              borderTop: "1px solid rgba(255,255,255,.08)",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontFamily: "Grotesk", fontSize: px(20), color: "#d9b25f" }}>
              {data.traitsHeldCount} traits
            </span>
            <span style={{ fontSize: px(19), color: "#8a8a92" }}>tenpoint.site/{username}</span>
          </div>
        </div>
      </div>

      <span
        style={{
          fontFamily: "Grotesk",
          fontSize: px(22),
          letterSpacing: px(9),
          textTransform: "uppercase",
          color: "#71717a",
          marginTop: px(46),
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

function Head({
  username,
  displayName,
  memberSince,
  avatarUrl,
  data,
  hideNums,
  px,
}: {
  username: string;
  displayName: string;
  memberSince: number;
  avatarUrl: string | null;
  data: HomeTasteCardData;
  hideNums: boolean;
  px: (n: number) => number;
}) {
  const filled = data.mean === null ? 0 : Math.max(1, Math.min(5, Math.round(data.mean / 20)));

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: px(14) }}>
        <div
          style={{
            width: px(52),
            height: px(52),
            borderRadius: px(999),
            overflow: "hidden",
            background: "#26262d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Grotesk",
            fontSize: px(24),
            color: "#eceae6",
          }}
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={avatarUrl} width={px(52)} height={px(52)} style={{ objectFit: "cover" }} />
          ) : (
            displayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "Grotesk", fontSize: px(26), color: "#9ab4cc" }}>
            @{username}
          </span>
          <span
            style={{
              fontFamily: "Grotesk",
              fontSize: px(17),
              letterSpacing: px(2),
              textTransform: "uppercase",
              color: "#6a6a72",
              marginTop: px(3),
            }}
          >
            Since {memberSince}
          </span>
        </div>
      </div>

      {data.mean !== null && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <span
            style={{
              fontFamily: "Grotesk",
              fontWeight: 700,
              fontSize: px(66),
              lineHeight: 1,
              color: "#eceae6",
              // The card still says a rating exists; it just does not say what
              // it is. Blank space here would read as an unrated account.
              opacity: hideNums ? 0.12 : 1,
            }}
          >
            {hideNums ? "•••" : formatTenths(data.mean)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: px(8), marginTop: px(10) }}>
            <Stars filled={filled} size={px(20)} />
            <span
              style={{
                fontSize: px(17),
                letterSpacing: px(1.6),
                textTransform: "uppercase",
                color: data.tier.labelColor,
              }}
            >
              {data.tier.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
