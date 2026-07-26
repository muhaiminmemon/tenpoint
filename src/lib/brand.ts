/**
 * Every user-visible mention of the product name comes from here.
 *
 * Names change. Scattering the string across metadata, emails, export
 * filenames, and a dozen components turns that into a scavenger hunt where
 * the one you miss is the one in a transactional email nobody reads until a
 * user forwards it back to you.
 */
export const APP_NAME = "Tenpoint";

/** Lowercase form: the wordmark in the nav, filename prefixes, the cookie. */
export const APP_SLUG = "tenpoint";

/** Shown on the signup form under the username field. */
export const APP_DOMAIN = "tenpoint.app";

export const APP_TAGLINE = "A film diary with ratings that mean something.";

/**
 * Positioning, deliberately kept as body copy rather than baked into the name.
 *
 * Saying we're an alternative to Letterboxd is nominative fair use — the
 * ordinary, protected way to describe what a product competes with. Building
 * the brand *out of* their mark is not the same thing and is not protected,
 * which is why this sentence lives here and not in `APP_NAME`.
 */
export const APP_POSITIONING = "A better Letterboxd.";

/**
 * Fallback contact address for the legal pages, used when `CONTACT_EMAIL`
 * isn't set. Both `/privacy` and `/terms` display it, so it lives here rather
 * than being typed twice and drifting.
 */
export const SUPPORT_EMAIL = "support@tenpoint.com";

export const APP_DESCRIPTION =
  "A better Letterboxd. Log what you watch, rate it in tenths, keep your rewatch history honest, and find something to watch with a friend.";
