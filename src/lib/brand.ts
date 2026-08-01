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
export const APP_DOMAIN = "tenpoint.site";

export const APP_TAGLINE = "A film diary with ratings that mean something.";

/**
 * Positioning, stated as what this product is rather than what it beats.
 *
 * An earlier line named a competitor directly. Naming one is legally fine —
 * describing what you compete with is nominative fair use — but it makes the
 * other product the subject of your own first sentence, and a reader has to
 * know them to understand us. The claim is stronger made on its own terms: the
 * scale is the argument, and anyone arriving from a five-star app recognises
 * what it answers without being told.
 *
 * The trademark disclaimer in `/terms` still names them, deliberately. That
 * one exists to disclaim a relationship, and it cannot do that job without
 * saying whose relationship it is disclaiming.
 */
export const APP_POSITIONING = "Ratings that mean something.";

/**
 * Fallback contact address for the legal pages, used when `CONTACT_EMAIL`
 * isn't set. Both `/privacy` and `/terms` display it, so it lives here rather
 * than being typed twice and drifting.
 */
export const SUPPORT_EMAIL = "support@tenpoint.site";

export const APP_DESCRIPTION =
  "A film diary with ratings that mean something. Log what you watch, rate it in tenths, keep your rewatch history honest, and find something to watch with a friend.";
