/**
 * Reads a JSON body without throwing. A 500 that returns an HTML error page
 * would otherwise reject inside a handler and leave the UI frozen with no
 * message, so every fetch site goes through here.
 */
export async function readJson<T = Record<string, unknown>>(res: Response): Promise<Partial<T>> {
  try {
    return (await res.json()) as Partial<T>;
  } catch {
    return {};
  }
}

/**
 * Validates a `?next=` destination before redirecting to it.
 *
 * A bare `startsWith("/")` is not enough: `//evil.com` is a protocol-relative
 * URL that leaves the site entirely, and some browsers normalise the
 * backslash form `/\evil.com` into the same thing. Either one turns the login
 * page into an open redirect, which is what makes a phishing link look like
 * it points at us right up until the moment it doesn't.
 */
export function safeNextPath(next: string | null | undefined, fallback: string): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** The error message from a failed response, or a fallback worth showing. */
export async function errorFrom(res: Response, fallback: string): Promise<string> {
  const data = await readJson<{ error: string }>(res);
  return typeof data.error === "string" && data.error ? data.error : fallback;
}
