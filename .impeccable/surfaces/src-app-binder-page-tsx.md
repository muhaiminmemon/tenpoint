---
version: 1
slug: "src-app-binder-page-tsx"
primary_target: "src/app/binder/page.tsx"
related_targets: ["src/components/BinderRegistry.tsx","src/components/PinnedPlate.tsx","src/lib/binder.ts","src/lib/binder-plate.ts"]
---

# /binder

**Scope:** the binder route, its five fascicles, and the pinned-plate block it
places on `/[username]`. Visitor mode: **Experience** — the reader is inside
the collection itself, and the interface recedes behind the plates.

## Audience and job

The account holder, alone, looking at their own record. Not a task: they are
reading what their watching has amounted to, and deciding which single plate
represents them. The only action on the page is the pin.

## Direction

**Plate registry / catalogue raisonné.** Chosen because a catalogue is the one
document format that already solves the hard rule: it describes works the
collection does not hold, in full, with a plate number — "not in this
collection" is a standing convention there, not a locked-content pattern. It
also never prints a completion figure, which is the brief's other constraint.
Assigned by roll, seed `f462bd63`, candidate 4 of 7.

Visual system is the app's existing projection-room graphite, unchanged. No new
palette, face, or component language was introduced.

## The rules that carry it

- **Withhold light, never legibility.** A plate not held prints in full behind a
  glassine veil — the finish reads through it, motion and glow are what stop.
  Labels never drop below `ash` (6.7:1 on the page ground). Dimming a whole slot
  is the failure mode this exists to avoid.
- **No denominator, anywhere.** "Plates standing: 23" with no total. A standing
  is a fact about one plate; the moment it is summed against a total the record
  becomes a chore list.
- **Expansion in place.** No route, no modal. A plate opens where it sits.
- **One pin, enforced by storage.** `users.pinned_plate` is a single nullable
  column, so "one at a time" is structural rather than a rule to police. Standing
  is re-derived server-side on every pin; it is never accepted from the client.
- **Object hinted, not simulated.** Slot corner ticks, page dividers with a
  binding stub, plate numbers in tabular figures. No page-turn, no leather, no
  three-ring skeuomorphism.

## Memorable moment

The season column read top to bottom: taste drift as a ledger, with a
permanently empty slot for a season nobody played. Irreversibility is what makes
the filled plates worth anything, so the empty one is drawn as carefully as the
rest.

## Motion

One authored moment: the hairline rules draw left-to-right in sequence, like a
page being ruled. Content is fully legible from the first frame — nothing fades
in. Held specimens then keep the foil motion the tier system already owns;
unheld ones sit still. Motion is therefore semantic, not decorative.

## Unresolved

- `computeTier` gates on rated-film count alone, so the "any three of six"
  milestones are displayed as progress at each step, not as what actually issues
  a tier. The tier plates are worded to match the code, not the intention. If
  the milestones should genuinely gate, that is a change to `computeTier`.
- The binder has no public view. A profile shows only the one pinned plate;
  whether another user can browse someone else's binder is undecided.
