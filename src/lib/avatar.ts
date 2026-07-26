/**
 * Avatars are served from `/api/avatar/[userId]`, never inlined into a page.
 *
 * `users.avatarUpdatedAt` is the only avatar data a normal query reads: a
 * timestamp, not a blob. It doubles as a cache key, so the response can be
 * marked immutable and cached for a year — a new upload writes a new stamp,
 * which is a different URL.
 */
export function avatarSrc(
  userId: string,
  avatarUpdatedAt: Date | string | null | undefined,
): string | null {
  if (!avatarUpdatedAt) return null;
  const stamp =
    avatarUpdatedAt instanceof Date
      ? avatarUpdatedAt.getTime()
      : new Date(avatarUpdatedAt).getTime();
  return `/api/avatar/${userId}?v=${stamp}`;
}

/** Largest avatar we accept, before base64 expansion. */
export const MAX_AVATAR_BYTES = 512 * 1024;

export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type ParsedImage = { mimeType: string; base64: string; bytes: number };

/**
 * Validates a `data:` URL and splits it into parts. Rejects anything that
 * isn't one of the three raster types we serve, which keeps `image/svg+xml`
 * out: an SVG is a script-bearing document, and we serve these from our own
 * origin.
 */
export function parseImageDataUrl(dataUrl: string): ParsedImage | null {
  const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;

  const [, mimeType, base64] = match;
  if (!(ALLOWED_AVATAR_TYPES as readonly string[]).includes(mimeType)) return null;

  // 4 base64 chars per 3 bytes, minus whatever the padding stands in for.
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const bytes = Math.floor((base64.length * 3) / 4) - padding;
  if (bytes <= 0 || bytes > MAX_AVATAR_BYTES) return null;

  return { mimeType, base64, bytes };
}
