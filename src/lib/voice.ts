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
export function inThirdPerson(text: string): string {
  return text
    .replace(/\bYou\b/g, "They")
    .replace(/\byou\b/g, "they")
    .replace(/\bYour\b/g, "Their")
    .replace(/\byour\b/g, "their")
    .replace(/\bYours\b/g, "Theirs")
    .replace(/\byours\b/g, "theirs")
    .replace(/\byourself\b/g, "themselves");
}
