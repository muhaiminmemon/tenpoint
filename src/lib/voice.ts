/**
 * The same reading, told about somebody else.
 *
 * Every sentence the card generates is written to the person it belongs to:
 * "you rate it 2.9 above the crowd". On a friend's binder that is the wrong
 * mouth, and the alternative — threading a pronoun pair through forty string
 * templates — puts a conditional inside every sentence in the product for the
 * sake of one page.
 *
 * A single transformation at the edge is smaller and safer. It works because
 * "you" and "they" take the same verb forms in English: you rate / they rate,
 * you have watched / they have watched, you would be / they would be. Nothing
 * here has to know about tense.
 *
 * Applied only to generated sentences, never to titles or names, so a film
 * called Your Name is not renamed on the way through.
 */
/**
 * The words that mark a trailing "you" as an object rather than a subject.
 *
 * English spells both the same, so "whatever is standing behind you" and
 * "before you rate it" look alike to a regex while wanting different pronouns —
 * "behind them" but "before they rate it". The cue alone is not enough, which
 * is why the rule below also requires the "you" to end its clause: a subject
 * "you" is followed by its verb, an object "you" by punctuation or the end of
 * the string.
 */
const OBJECT_CUES =
  "above|across|after|against|around|at|before|behind|below|beneath|beside|between|beyond|by|for|from|gave|give|given|gives|in|into|near|of|off|on|over|past|through|to|toward|towards|under|with|without|than";

export function inThirdPerson(text: string): string {
  return text
    // Objective case first, or "behind you." becomes "behind they."
    .replace(new RegExp(`\\b(${OBJECT_CUES}) you\\b(?=[.,;:!?)]|$)`, "gi"), (_m, cue) => `${cue} them`)
    .replace(/\bYou\b/g, "They")
    .replace(/\byou\b/g, "they")
    .replace(/\bYour\b/g, "Their")
    .replace(/\byour\b/g, "their")
    .replace(/\bYours\b/g, "Theirs")
    .replace(/\byours\b/g, "theirs")
    .replace(/\byourself\b/g, "themselves");
}
