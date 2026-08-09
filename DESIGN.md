---
name: Tenpoint
description: A film and television diary with ratings that mean something.
colors:
  void: "#0e0e10"
  carbon: "#141417"
  lift: "#16161a"
  tray: "#1c1c21"
  tray-2: "#232329"
  seam: "#2a2a31"
  edge: "#3a3a45"
  paper: "#eceae6"
  ash: "#9a9aa3"
  dim: "#6a6a72"
  beam: "#8faecc"
  beam-edge: "#34506a"
  gold: "#d9b25f"
  good: "#8fbf7f"
  warn: "#c4756a"
  # Tier finishes — the collectible rank palette. Earned objects only.
  tier-common-label: "#8a8a92"
  tier-uncommon-rim: "#34343d"
  tier-uncommon-ground: "#30303a"
  tier-epic-rim: "#5a5570"
  tier-epic-foil: "#b3a3d6"
  tier-epic-ground: "#2a2740"
  # Card stocks — the taste palette. Card grounds only.
  stock-vellum-low: "#2b2620"
  stock-vellum-high: "#3b352b"
  stock-neon-high: "#1d2c3c"
  stock-nebula-low: "#231e36"
  stock-nebula-high: "#3b3054"
  # Variant accents dealt from the highest-rated decade.
  accent-emerald: "#7fb59a"
  accent-amethyst: "#a98fd6"
typography:
  display:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "clamp(2rem, 5vw, 2.375rem)"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "26px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "22px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  subhead:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  item:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "17px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.02em"
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  meta:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  pill:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  numeric:
    fontFamily: "Space Grotesk, sans-serif"
    fontWeight: 500
    letterSpacing: "-0.01em"
    fontFeature: "tnum 1"
  card-name:
    fontFamily: "Instrument Serif, serif"
    fontSize: "38px"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.01em"
  card-lead:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
  card-qualifier:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.2em"
  card-figure:
    fontFamily: "Space Grotesk, sans-serif"
    fontSize: "20px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.01em"
  card-label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "9px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0.14em"
  card-fallback:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "8px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "normal"
rounded:
  panel: "12px"
  card: "6px"
  cell: "5px"
  plate-cell: "4px"
  thumb: "3px"
  tick: "2px"
  focus: "4px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "6px 16px"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.carbon}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "6px 12px"
  button-secondary-hover:
    backgroundColor: "{colors.tray}"
    textColor: "{colors.paper}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ash}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "6px 12px"
  button-quiet-hover:
    textColor: "{colors.paper}"
  button-destructive:
    backgroundColor: "{colors.warn}"
    textColor: "{colors.carbon}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "6px 16px"
  input-text:
    backgroundColor: "{colors.carbon}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.card}"
    padding: "6px 12px"
  panel:
    backgroundColor: "{colors.tray}"
    textColor: "{colors.paper}"
    rounded: "{rounded.card}"
    padding: "16px"
  poster:
    backgroundColor: "{colors.tray}"
    rounded: "{rounded.card}"
---

# Design System: Tenpoint

## Overview

**Creative North Star: "The Projection Room"**

The room is dark so that the screen carries everything. Every surface in Tenpoint
is a step on a narrow graphite ladder — six near-blacks separated by a few points
of lightness — and none of them are trying to be looked at. The chrome recedes to
make room for the two things that actually have colour: the posters, which come
from the films and shows themselves, and `beam`, a pale projector blue that
appears only where attention is being directed.

This is a dark-only interface, and not as a theme choice — `color-scheme: dark`
is declared once and there is no light counterpart. The consequence is that
contrast is built from tone rather than from hue. A panel reads as raised because
it sits one step up the ladder from what's behind it and is edged with a hairline,
not because it casts a shadow. Nothing in the system glows, shimmers, or pulses
to attract a glance; the one continuously-moving element, the holographic foil on
a taste card, belongs to an object the viewer earned rather than to the interface.

Density is the other half of it. This is built for someone with several hundred
titles who is logging, rating, and reordering dozens of times in a sitting, so
rows are tight, figures are tabular, and controls are small and unremarkable. The
interface would rather be legible at a glance than impressive on first sight.

**Key Characteristics:**

- Dark-only, tonal, and flat: depth comes from lightness steps, never from shadow.
- Two accents with strict and different jobs — `beam` directs attention, `gold`
  marks what was earned.
- Posters are the colour. The palette is deliberately desaturated so they stay
  the loudest thing on any screen.
- Two faces: Space Grotesk sets everything structural and numeric, IBM Plex Sans
  sets everything read as prose.
- Numbers align. Ratings are tabular figures at one decimal, always.
- Motion is authored and sparse: entrances settle, exits accelerate, and nothing
  animates from `opacity: 0`.

## Colors

A narrow graphite ladder with two accents, tuned so that a film poster dropped
onto any surface is instantly the most saturated thing in view.

### Primary

- **Projector Beam** (`#8faecc`): The interface accent, and the only one. Focus
  rings (2px, 2px offset), text selection, links, the focused border on an input,
  and the "you are here" state in navigation. It is a pale, slightly cool blue
  because it is meant to read as light falling on the chrome rather than as paint
  applied to it.
- **Beam Edge** (`#34506a`): The dimmed companion, used for beam-tinted borders
  and low-emphasis rings where the full accent would shout — outlined secondary
  actions, focus rings at `ring-1`.

### Secondary

- **Foil Gold** (`#d9b25f`): The warm accent, and a restricted one. It marks two
  things and nothing else: **the top of a scale** — a rating of 9.0 or above
  (`src/lib/format.ts`: `tenths >= 90` returns `text-gold`), the "Soon" priority
  in the watchlist queue, an unread count on navigation — and **what a viewer
  earned**: tier plates, the plate state `yours`, the taste card's held-trait
  count and milestone pips, and the foil ramp. See **The Earned Gold Rule**.

### Tertiary

- **Signal Green** (`#8fbf7f`): Confirmation and positive state only.
- **Signal Clay** (`#c4756a`): Errors, destructive actions, and warnings. A muted
  terracotta rather than a pure red, so a delete button belongs to the same room
  as everything else.

### Neutral

The ladder, darkest to lightest. Each step is a surface, not a decoration.

- **Void** (`#0e0e10`): The page ground. The room itself.
- **Carbon** (`#141417`): The text colour on inverted controls, and the ground for
  inputs sitting inside an already-raised panel.
- **Lift** (`#16161a`): One step up from the page, for a surface that should read
  as distinct without announcing itself.
- **Tray** (`#1c1c21`): The default raised surface — panels, cards, poster
  placeholders, secondary buttons on hover.
- **Tray 2** (`#232329`): Tray under interaction. The hover and active step.
- **Seam** (`#2a2a31`): The hairline. Dividers between rows, borders on controls.
  Nearly invisible against carbon, which is exactly right for a divider inside a
  list.
- **Edge** (`#3a3a45`): One step up from seam, for the outline of a panel that is
  meant to read as its own surface rather than the hairline between two rows.
- **Paper** (`#eceae6`): Body text, and the fill of the primary button. A warm
  off-white, never pure `#fff` except as the primary button's hover.
- **Ash** (`#9a9aa3`): Secondary text. Labels, metadata, supporting copy.
- **Dim** (`#6a6a72`): Tertiary text and placeholders. The floor for anything
  still meant to be read.

### The tier finish palette

A second, separate palette, and the only one that exists outside the graphite
ladder. It dresses the six collectible card ranks and appears nowhere else in
the product — not in chrome, not on a page, not on a control.

- **Uncommon** — `#34343d` rim over `#30303a`: one tonal step past `edge`, a
  refined edge rather than a colour.
- **Rare** — `beam-edge` → `beam` gradient. The first rank that takes an accent.
- **Epic** — `#5a5570` → `#b3a3d6` over `#2a2740`: a silver-violet foil.
- **Legendary** — `#4a3f24` → `gold` → `#3a3a44`: warm metal, the one place a
  conic gradient is used.
- **Mythic** — `beam` → `gold` → `warn` in full interference. All three system
  accents at once, which is why no other surface may do it.

These are finishes on an earned object, so they follow **The Earned Gold Rule**
rather than breaking it. A tier colour used as UI chrome is a defect.

### The card stock palette

The third and last palette: the ground a taste card is printed on, dealt from
the theme the library keeps returning to. Every stock is a two-stop gradient at
`150deg` with an almost invisible texture layered over it, and all of them sit
in the same near-black register as the page, so the card reads as an object made
of the room rather than a bright rectangle dropped into it.

- **Vellum** `#2b2620 → #3b352b` — warm paper. People and rooms.
- **Neon Rain** `#111820 → #1d2c3c` — cold blue. The dark: noir, the occult.
- **Filmstrip** `#1a1a1f → #26262d` — near-neutral graphite. Motion.
- **Marble** `#23232a → #3a3a43` — cool stone. The record and remarks on it.
- **Nebula** `#231e36 → #3b3054` — violet. What could not happen.
- **Bare** `#1c1c21` — flat `tray`, no texture. Nothing has emerged yet.

Textures never exceed **4.5% opacity** (`rgba(236,234,230,.014)` to `.045`).
They are felt rather than seen; a visible pattern would compete with the poster
quartet the card is built around.

**The Three Palettes Rule.** The graphite ladder dresses the interface, the tier
palette dresses rank, and the stock palette dresses taste. They never trade: a
stock colour in chrome, a tier colour on a page, or a UI token as a card ground
all break the one distinction that lets a card read as a printed object rather
than another panel.

### Named Rules

**The Earned Gold Rule.** `beam` directs attention; `gold` says *this one is
worth something*. Gold is legitimate in exactly two places: the top of a scale
(9.0+ ratings, "Soon" priority, an unread count) and things derived from what a
viewer actually watched (tiers, plates, traits, foil). It is never a surface, a
button fill, a link colour, or a decorative highlight. Its scarcity is the point:
the moment gold appears on ordinary chrome, a 10.0 stops reading as special.

The rating case is the one to reason from. Everything below 9.0 renders in the
neutral text colours; only the top shelf takes the accent, so a library scanned
at speed shows its own peaks without any element being enlarged, boxed, or
badged.

**The Posters Carry It Rule.** No surface, control, or accent may compete with
poster artwork for saturation. When a screen feels flat, the answer is a poster
or a tonal step, never a more colourful UI.

**The Two-Step Rule.** Adjacent surfaces differ by at least one rung of the ladder
and are separated by `seam` or `edge` when they need a boundary. Never place a
`tray` panel directly on a `tray` background and rely on a border alone to
explain it.

## Typography

**Display Font:** Space Grotesk (400 / 500 / 700, with `sans-serif` fallback)
**Body Font:** IBM Plex Sans (400 / 500 / 600, with `sans-serif` fallback)
**Name Font:** Instrument Serif (400 italic only, with `serif` fallback) — one
role, one cut. See **The Third Face Rule**.

**Character:** A geometric grotesque against a humanist sans. Space Grotesk's
slightly odd, engineered letterforms do all the structural work — headings, any
number, anything that should read as a label on an instrument — while IBM Plex
Sans carries everything a person actually reads in sentences. The pairing splits
along a real line: Space Grotesk states, Plex explains.

Space Grotesk is always tracked in (`-0.02em` on display via `.display`,
`-0.01em` on figures via `.num`); the faces are close enough in colour that the
tracking is a good part of what tells them apart.

### Hierarchy

- **Display** (500, 32px → 38px from `sm`, line-height 1.05): Page-defining
  titles. The landing hero and top-level route headings.
- **Headline** (500, 26px): Section headings inside a page, and the binder's
  plate headings.
- **Title** (500, 22px): Diary group headings, sticky film headers.
- **Subhead** (500, 19px): Sub-sections within a section.
- **Item** (500, 17px): The title of a row, card, or list entry.
- **Body** (400, 15px, line-height 1.55): Default. Prose, reviews, descriptions.
- **Label** (500, 13px): Buttons, form labels, the title of a row in a dense list.
- **Meta** (400, 11px): Row metadata in a dense list — the year beside a title,
  a date, a panel's uppercase section label. The step between Label and Caption,
  and the one that makes a list row fit on one line.
- **Caption** (400, 12px, `--text-2xs`): Timestamps, counts, the smallest legible
  supporting text.
- **Pill** (400, 10px): Tag pills and micro-labels — "Rewatch", "Review", a
  state chip on a row. The floor of the page ramp; nothing in page chrome goes
  below it.

### The card micro scale

The taste card and binder plates are small printed objects (roughly 216×342), and
they run their own scale below the page ramp. These are real documented steps,
not one-off values — anything set on a card should land on one of them:

- **38px** — the archetype name on the taste card, set in Instrument Serif
  italic. The card's lead line.
- **30px** — the lead line of a card set in the display face, where no serif
  name applies.
- **13px** — the tracked uppercase qualifier above the archetype name.
- **26px / 17px / 15px** — binder plate headings and plate body.
- **20px** — a demoted primary figure. On the taste card face this is the rating.
- **11px** — theme chips.
- **10px** — micro-labels and figures: the star row, the trait count, a chip's
  percentage.
- **9px** — the handle, "Since {year}", the tier name, the variant name, the
  "Taste class" field label.
- **8px** — a poster cell's text fallback when no artwork exists.

Micro-labels at 10px and below are uppercase and widely tracked (`0.1em` to
`0.18em`); the tracking is what keeps them legible at that size, and it is the
one place in the system where letter-spacing goes positive.

**On the taste card face, the name outranks the number.** The archetype leads at
30px and the rating demotes to 20px below a hairline. This is deliberate and
recent: the card is an identity artifact, so the thing a reader should carry away
is what their taste *is*, not what it averages. The rating keeps a rule above it
so the demotion reads as a separate statement rather than an afterthought.

### Named Rules

**The Card Scale Rule.** Page type and card type are separate ramps. Never set
page-ramp sizes on a card, or card-ramp sizes in page chrome. A card is a printed
object at its own scale; the moment its type matches the surrounding page it
stops reading as an object and becomes a panel.

**The Tabular Rule.** Any figure that appears in a column, or that a reader might
compare against another figure — every rating, every count, every year — carries
`.num`: Space Grotesk with `font-variant-numeric: tabular-nums` and `tnum`. A
rating rendered in the body face is a defect. Ratings display at one decimal
without exception (`8.0`, never `8`).

**The Two Voices Rule.** Space Grotesk for structure and number, IBM Plex Sans for
prose. A heading in Plex or a paragraph in Grotesk breaks the one distinction the
type system makes.

**The Third Face Rule.** Instrument Serif italic sets the taste card's archetype
name at 38px, and nothing else — not headings, not the binder, not a page title.
It earns its place because the archetype is the only string in the product that
is a *name* rather than a field, and neither working face can say a name. The
qualifier before it ("Deepcut", "Midnight") stays a tracked 13px label in the
body face, so the card reads qualifier-then-thing, which is the order the
archetype is actually built in. Only the italic cut is loaded; a roman
Instrument Serif anywhere is drift.

## Layout

A single centred column: `max-w-5xl` (64rem) with `px-4` gutters, `pt-6` above and
`pb-24` below on mobile to clear the fixed bottom navigation, relaxing to `pb-6`
from `sm` (640px) up. `640px` is effectively the system's only structural
breakpoint — it is where the bottom nav gives way to the top nav, where sheets
stop rising from the bottom and start sliding in from the right, and where the
command palette stops being a sheet and becomes a centred dialog.

Spacing follows Tailwind's 4px scale, used tightly: `gap-1.5` to `gap-3` inside a
control cluster, `p-3` to `p-4` inside a panel, `mt-5` to `mt-10` between sections.
The density is deliberate — this is a screen someone scans, not one they read.

A section that must run edge-to-edge escapes the column with `.bleed`, which
measures against `100vw` and pulls back by `calc(50% - 50vw)`. Because `100vw`
includes the scrollbar gutter, `body` carries `overflow-x: clip` to trim the
overhang; `clip` rather than `hidden`, which would break sticky positioning.

Poster grids use a `2/3` aspect ratio; diary and binder tiles use `1/1.05`.

## Elevation & Depth

**This system has no shadows.** Depth is entirely tonal: a surface reads as
raised because it occupies a lighter step of the graphite ladder than the surface
behind it, bounded by a `seam` or `edge` hairline where a boundary is needed.
`void` → `lift` → `tray` → `tray-2` is the full vocabulary of "above", and there
is nothing beyond it.

This is an invariant, not an accident of the current implementation. Adding
`box-shadow` to a panel, card, sheet, or button would introduce a second and
contradictory depth model, and on a near-black ground a shadow is close to
invisible anyway — it reads as blur, not as height.

### Shadow Vocabulary

One deliberate exception exists, and it is not a UI shadow:

- **Marquee object drop** (`filter: drop-shadow(0 24px 38px rgba(0, 0, 0, 0.55))`):
  Applied to the landing marquee's floating objects to seat them in space. It is
  a `drop-shadow` filter on an illustrated element rather than a `box-shadow` on
  a surface, and it is a *resting* property rather than a keyframe, so the
  objects keep their depth when reduced motion disables the animation.

### Named Rules

**The Tonal-Only Rule.** Surfaces never lift with shadow. If something needs to
read as raised, move it up a rung and give it a hairline. The only permitted
shadow in the system is the marquee's `drop-shadow`, on illustration, not chrome.

## Shapes

One radius does most of the work — **`--radius-card`, 6px** (`rounded-card`, ~160
uses) — but it is not the only one, and the others are not strays. Radius here
tracks the *size of the object*, so a corner stays proportionate to what it is
cutting:

- **12px** (`rounded-xl`): page-level panels — the containers that sit directly
  on the page and are bounded with `edge` rather than `seam`. The homepage
  recent-viewings panel and the import blocks are the pattern.
- **6px** (`rounded-card`): the control and component radius. Buttons, inputs,
  cards, segmented controls, sheets, posters in a grid. The default; reach for it
  unless the object is clearly larger or smaller than a control.
- **5px / 4px / 3px / 2px**: the small-object scale, for things *inside* a card
  or row — poster cells on a taste card (5px), plate cells (4px), row thumbnails
  (3px), accent ticks (2px). A 6px corner on a 20px-wide thumbnail reads as a
  blob; these keep the cut proportionate.
- **`rounded-full`**: genuinely circular or pill-shaped things — avatars, theme
  chips, tag pills, the dial's increment buttons.
- **4px**: the global focus ring's own radius.

`rounded-lg` (8px), `rounded-[7px]`, and `rounded-[14px]` appear a handful of
times and are drift rather than intent; prefer the nearest documented step.

### Named Rules

**The Proportionate Corner Rule.** Radius tracks the size of the object, not the
system's preference for one number. A page panel takes 12px, a control takes 6px,
and anything living inside a card or row takes 2–5px. The test: the corner should
look like the same *cut* at every scale, which means the value has to change.

**The Two Borders Rule.** `seam` is the hairline *inside* a component — between
rows, around a control. `edge` is the outline of a panel that sits on the page as
its own surface, and it travels with the 12px radius. Using `seam` on a page
panel makes it dissolve into the background; using `edge` inside a list makes
every row shout.

Borders are hairlines at 1px, in `seam` for a boundary inside a component and
`edge` for the outline of a panel that is its own surface. Borders are structural,
never decorative — there is no ornamental rule, divider flourish, or framing
device in the system.

Form language is rectangular and quiet. Objects that want to read as physical —
the taste card, binder plates — are *hinted* rather than simulated: corner ticks,
plate numbers in tabular figures, a binding stub on a divider. There is no
leather, no page-turn, no three-ring skeuomorphism.

## Components

Character line: **quiet chrome, precise readouts.** Controls are deliberately
unremarkable so the data reads loud. Every control shares the same 6px radius and
the same `seam` hairline; what distinguishes them is fill, not shape.

### Buttons

- **Shape:** 6px radius (`rounded-card`) on every variant. No pills, no squares.
- **Primary:** Inverted — `paper` fill with `carbon` text, `font-medium`, set in
  the display face (`.display`). Padding runs `px-4 py-1.5` for inline actions and
  `py-2.5`/`py-3` full-width in forms and sheets. Hover goes to pure `#fff`;
  disabled drops to `opacity-50`. The inversion is the point: it is the only
  element on a dark page that is nearly white, so there is never a question of
  which action is the main one.
- **Secondary:** Transparent fill, `seam` border, `paper` text, `px-3 py-1.5`.
  Hover fills to `tray` (or `tray-2` when already sitting on `tray`).
- **Quiet:** Transparent fill, `seam` border, `ash` text, hovering to `paper`.
  For actions that should be available without being offered.
- **Destructive:** Two forms. The confirming action is a `warn` fill with `carbon`
  text; the action that *opens* a destructive flow is an outline —
  `border-warn/40` with `warn` text, hovering to `warn/10`. Destructive intent is
  stated in colour before it is committed, never by a red fill on first offer.
- **Beam action:** `beam-edge` border with `beam` text on a `#161d24` tinted
  ground, hovering to `#1a232c`. Used where an action is also a piece of
  wayfinding rather than a commitment.
- **Hover / Focus:** `transition-colors` only — colour moves, geometry does not.
  Buttons never scale, lift, or translate on hover.

### Inputs / Fields

- **Style:** `seam` border on a ground one step *below* their container — `carbon`
  inside a `tray` panel, `tray` on the page, `lift` in a dense toolbar. An input
  is a recess, which is why it darkens rather than lightens.
- **Focus:** The border becomes `beam` and the native outline is suppressed
  (`focus:border-beam focus:outline-none`). Everything else in the system uses the
  global `:focus-visible` ring instead; inputs are the one place where the border
  itself carries focus.
- **Placeholder:** `dim`, occasionally `ash` where the field is the primary
  affordance on the screen.
- **Disabled:** `opacity-50` on the control, never a colour change.

### Cards / Containers

- **Corner Style:** 6px (`rounded-card`).
- **Background:** `tray` by default; `carbon` for a recessed block inside an
  already-raised panel.
- **Shadow Strategy:** None. See Elevation & Depth.
- **Border:** 1px `seam`, or `edge` when the panel must read as its own surface.
- **Internal Padding:** `p-3` for dense rows, `p-4` for standard panels.

### Navigation

Two navigations, split at 640px. Below it, a fixed bottom bar with `tray` tiles,
`seam` borders, and `active:bg-tray-2` — active state on press rather than hover,
because there is no hover on a phone. Above it, a top nav in the same vocabulary.
The current route is marked with `beam`. The content column reserves `pb-24` on
mobile so the fixed bar never covers the last row.

### Segmented Controls

A single `rounded-card` container with a `seam` border and `overflow-hidden`, with
the segments butted directly against each other — the container clips the corners
so individual segments need no radius. Selected segment takes a `paper`-family
fill with `carbon` text; unselected sit transparent with `ash` text hovering to
`paper`. Used for the film/series browse toggle, diary view modes, and auth tabs.

### Signature Component: The Rating Dial

The product's hot path and its clearest statement of intent. A grid of tenths
rendered in `.num` at `h-9`, each a `rounded-card` cell that transitions on colour
alone, with a secondary row at `h-7` for finer selection. `/ 10` sits beside it in
`ash` at `text-sm`, so the scale is stated rather than assumed. An anchors panel
(`rounded-card border-seam bg-tray p-3`) can be opened to show what each value
means. Nothing about it animates; a rating is a decision, not an effect.

### Signature Component: The Foil Card

The one continuously-moving surface in the system, and the only place `gold`
appears. Two stacked repeating gradients — a hard stripe pattern and a soft colour
ramp in the product's own iridescents (`beam` → `#a98fd6` → `#7f9fd6` → `gold`) —
are blurred, duplicated, and blended by `difference`, so the interference between
the two layers produces shifting iridescence rather than a band sliding past. It
travels on a 48s cycle by default (`--sweep`), radially masked from the top-right.

Over it sits `.card-grain`: a banded radial hotspot printed through an inlined 8×8
Bayer dither (193 bytes, base64, no request to fail), which makes the finish read
as pressed onto stock rather than lit in software.

**A specimen you do not hold uses `.foil-still`** — the identical foil with the
travelling layer stopped. This is the system's model for withheld content: motion
and glow stop, legibility does not. Never dim a whole slot to say "not yours".

## Do's and Don'ts

Grounded in the incumbent implementation. Where the code does not confirm a
rejection, none is asserted here.

### Do:

- **Do** build depth from the tonal ladder — `void` → `lift` → `tray` → `tray-2`,
  bounded by `seam` or `edge`. **The Tonal-Only Rule.**
- **Do** set every comparable figure in `.num` (Space Grotesk, `tabular-nums`,
  `tnum`), and render ratings at one decimal always. **The Tabular Rule.**
- **Do** reach for `beam` when directing attention, and `gold` only for the top of
  a scale or something earned. **The Earned Gold Rule.**
- **Do** keep every interactive element's `:focus-visible` ring intact — 2px
  `beam`, 2px offset, 4px radius. It is declared globally; removing an outline
  locally without replacing it is a regression.
- **Do** pair every entrance animation with an exit. Exits are shorter, ease *in*
  rather than out, and travel less than the entrance did.
- **Do** add any new named animation to the `prefers-reduced-motion` block in
  `globals.css`. That block currently disables every named animation in the
  system; an unlisted one is a defect.
- **Do** use `transition-colors` for hover states. Colour moves; geometry doesn't.
- **Do** state a scale rather than assume it — the dial prints `/ 10` beside the
  figure.

### Don't:

- **Don't** add `box-shadow` to any surface. The system has no shadow vocabulary,
  and on a near-black ground a shadow reads as blur rather than height.
- **Don't** introduce a light theme or a `prefers-color-scheme` branch. The
  interface is dark-only by declaration (`color-scheme: dark`), and the palette
  has no light counterpart. (Recorded in PRODUCT.md as a known gap, not owed work
  — but it is a system-wide change, not a component-level one.)
- **Don't** spend `gold` on ordinary chrome — no gold buttons, links, surfaces, or
  decorative highlights. It belongs to the top of a scale and to earned objects.
- **Don't** animate anything from `opacity: 0`. Content is legible from the first
  frame; only position, hairline scale, and shadow move. A slow connection must
  never show a blank hero.
- **Don't** restore browser default chrome. Scrollbars are removed system-wide
  (`scrollbar-width: none` plus the webkit pseudo-element) while scrolling itself
  is untouched; `outline: none` without the global `:focus-visible` replacement is
  a regression.
- **Don't** dim an entire element to indicate withheld or locked content. Stop the
  motion, veil the finish, keep the text at `ash` or better.
- **Don't** use pure `#fff` except as the primary button's hover state. Body text
  is `paper` (`#eceae6`).
- **Don't** simulate physical objects. Hint them — corner ticks, plate numbers,
  tabular figures. No leather, page-turns, or three-ring binder skeuomorphism.
- **Don't** let a UI surface out-saturate a poster. **The Posters Carry It Rule.**
