# Helsa Component Specs (v1)

Companion to `design/tokens.json` (token names below map to `--{token}` CSS custom
properties in Tailwind v4 `@theme`). Mobile-first; single light theme for MVP.
Mascot: "Pip" — `mascot-happy.svg`, `mascot-cheer.svg`, `mascot-sleep.svg`, `mascot-think.svg`
(all viewBox 0 0 200 200, safe from 40px to 160px, drop in 1:1 for placeholders).

Global rules
- Page bg `color-background`, cards/inputs/tab bar on `color-surface`.
- Body text `neutral-800`, headings `neutral-900` bold/extrabold, muted text `neutral-600`
  (never 500/400 for copy — those are placeholder/disabled only).
- Touch targets >= 44x44px. Focus-visible: `shadow-focus` ring on everything interactive.
- Motion respects `prefers-reduced-motion`: replace scale/overshoot with opacity-only fades.

## Buttons

Shared: `radius-button` (16px), label `text-lg` weight 700, height 52px, px 24px,
transition `duration-instant ease-standard`. Full-width on mobile forms.

**Primary (chunky, Duolingo-style)**
- Default: bg `primary-500`, text `primary-900` (AA 5.9:1 — deliberately dark-on-green, not white),
  `shadow-button-primary` (4px solid bottom edge in primary-700).
- Pressed/active: translateY(4px), shadow removed, bg unchanged. This "sink" IS the pressed state.
- Hover (desktop): bg `primary-400`.
- Disabled: bg `neutral-200`, text `neutral-400`, no edge shadow, no translate.
- Loading: keep width; label -> spinner (primary-900), aria-busy.

**Secondary**
- bg `color-surface`, 2px border `border-strong`, text `primary-700` weight 700,
  `shadow-button-secondary` bottom edge. Same pressed sink. Hover: bg `neutral-50`.

**Ghost**
- Transparent, text `primary-700` weight 700, no edge. Hover/pressed: bg `primary-50`.
- Use for "Skip", tertiary links, "See all".

**Destructive** (delete log, logout): secondary shape with text `color-danger`; confirm via sheet.

## Card

- bg `color-surface`, `radius-card` (16px), 1px border `color-border`, `shadow-card`,
  padding `spacing-card` (16px). Section gap on pages: 24px, page gutter 16px.
- Tappable cards: pressed = scale(0.98) over `duration-instant`; no hover lift on mobile.
- Skeleton: `neutral-100` blocks, `radius-sm`, gentle pulse (opacity 0.6↔1, 1.2s).

## Inputs (register/login, food log form, profile)

- Height 52px, `radius-input` (12px), bg `color-surface`, 2px border `border-strong`,
  value `text-base` `neutral-800`, placeholder `neutral-400`.
- Label above: `text-sm` weight 500 `neutral-700`, 6px gap. Helper: `text-sm` `neutral-600`.
- Focus: border `primary-600` + `shadow-focus`. Error: border `color-danger`, helper text
  `color-danger-strong`, bg `color-danger-soft` optional; error copy says what to do, not what's wrong
  ("Try at least 8 characters"), field keeps its value.
- Numeric macro fields (calories/protein/carbs/fat): `inputmode="decimal"`, unit suffix ("g", "kcal")
  in `neutral-500` inside the field, right-aligned.
- Food log form lives in a bottom sheet: `radius-xl` top corners, drag handle (36x4px `neutral-300`),
  `shadow-raised`, primary CTA pinned at bottom above safe area.

## Bottom tab bar

- Height `spacing-tabbar` (64px) + `env(safe-area-inset-bottom)`, bg `color-surface`,
  1px top border `color-border`. Tabs: Home, Reports, [Log], Profile.
- Center Log action: 56px circle, bg `primary-500`, plus icon `primary-900`, raised 12px above bar,
  `shadow-raised`. Opens the food-log sheet from anywhere.
- Active tab: icon + label `primary-700`, label `text-xs` weight 700. Inactive: `neutral-500`,
  weight 500. Switch transition `duration-fast`; no badges/notification dots in MVP.

## Streak flame badge (dashboard header + reports)

Pill, `radius-full`, height 36px, px 12px, flame icon 20px + count `text-xl` weight 800.
- **Active streak** (`current_days` >= 1): bg `accent-50`, flame `accent-500` (outline detail
  `accent-600`), count text `accent-700`. Label microcopy: "4-day streak".
- **Today not yet logged** (streak alive per API grace rule): same active style — do NOT show
  urgency, countdowns, or "don't lose it!" copy. Optional gentle line elsewhere: "Log a meal to keep
  your streak growing."
- **Zero/broken**: bg `neutral-100`, flame `neutral-300`, count `neutral-600`. Copy: "Start a new
  streak today" — never red, never "you lost/broke it". Show `longest_days` as a quiet stat on the
  profile ("Longest streak: 11 days"), not as a comparison taunt.
- On increment (first log of the day): flame scales 1 -> 1.15 -> 1 over `duration-celebrate ease-pop`. Once.

## Macro progress bars (dashboard "today vs targets")

One row per macro: label + values line, bar below.
- Label `text-sm` weight 500 `neutral-700`; values right-aligned `text-sm`: "82 / 120 g" with the
  numeric label color per macro (see tokens usage: protein `info-strong`, carbs `color-warning` hue
  family, fat `macro-fat`, calories `primary-700`).
- Bar: 12px tall, `radius-full`, track `neutral-100`. Fill colors: `macro-calories`,
  `macro-protein`, `macro-carbs`, `macro-fat`. Fill animates width over `duration-base ease-out-soft`
  on mount.
- **At 100%**: fill caps at full; small check glyph after values in `color-success`.
- **Over target**: bar stays FULL (no overflow visuals), fill switches to `color-warning`, values
  read "1,910 / 1,840 kcal · 70 over". Warning-not-shame: amber, factual, no icons of alarm, no red.
- **No targets** (`targets: null`, profile incomplete): show logged totals as plain numbers, bars at
  30% in `neutral-200`, plus one inline card: mascot-think 40px + "Add your details to get daily
  targets" + ghost button "Complete profile".

## Charts (reports: daily/weekly/monthly)

- Bars/lines use the four `macro-*` colors; never encode meaning by color alone — always a legend
  with text labels. Target shown as a dashed `neutral-400` reference line.
- Gridlines `neutral-200` 1px, axis labels `text-xs` `neutral-600`. Empty days render at zero, not
  omitted. Draw-in animation `duration-slow ease-out-soft`, skipped under reduced motion.
- Deltas from `/reports`: chips — within ±10% of target = `success-soft`/`success-strong`
  "on track"; below = `info-soft`/`info-strong` "below target"; above = `warning-soft`/`color-warning`
  "above target". Neutral language: "Protein −21% vs target", never "bad week".

## Empty states

Layout (vertically centered in the content area, max text width 280px, all centered):
1. `mascot-sleep.svg` at 120px
2. One-liner `text-lg` weight 700 `neutral-800`
3. Optional sub-line `text-sm` `neutral-600`
4. ONE primary button
Examples — Dashboard, no logs today: "Pip's still waiting on breakfast" / [Log a meal].
Reports, no data in range: "Nothing logged this week yet" / [Log a meal]. No guilt framing
("You haven't..." is banned); the mascot is sleepy, not disappointed.

## Onboarding carousel (3 slides)

- Slide: mascot/spot illustration 160px top-third; title `text-2xl` weight 800 `neutral-900`;
  body `text-base` `neutral-600`, max 2 lines; generous whitespace.
- Suggested slides: 1) log meals in seconds (mascot-happy), 2) see your macros vs targets
  (mascot-think), 3) grow a gentle streak (mascot-cheer).
- Dots: inactive 8px circle `neutral-200`; active 24x8px pill `primary-600`; morph over `duration-fast`.
- Bottom: primary button ("Next" -> "Get started" on last slide). "Skip" as ghost, top-right.
- Slide transition: horizontal swipe, `duration-slow ease-standard`.

## AI insight card (reports)

Distinct but calm — a tinted card, not a glowing "AI magic" box.
- bg `primary-50`, 1px border `primary-200`, `radius-xl` (20px), padding 20px.
- Header row: sparkle/leaf icon 20px `primary-600` + "Insight" `text-sm` weight 700 `primary-900`.
- Body: `text-base` `neutral-800`, render `text` verbatim from the API.
- Footer: the API `disclaimer` string verbatim, `text-xs` `neutral-600`, top-margin 12px. Always
  visible, never truncated or hidden behind a tooltip.
- Loading (endpoint can take seconds): mascot-think 48px left of two skeleton lines + caption
  "Pip is looking at your week…". Keep card height stable to avoid layout jump.
- If `generated_by` is "stub", render identically — no badge.

## Celebration micro-interaction (after logging a meal / streak milestone)

- Toast: card style (`radius-lg`, `shadow-raised`), anchored 12px above the tab bar,
  mascot-cheer at 48px + message `text-base` weight 700 `neutral-900`
  ("Logged! Nice one." / "7-day streak — steady does it.").
- Enter: opacity 0 -> 1 and scale 0.92 -> 1 over `duration-celebrate ease-pop`. Auto-dismiss after
  2.5s with a 250ms fade. Never stacks; a new toast replaces the current one.
- That's the ceiling: NO confetti storms, NO full-screen takeovers, NO sound, NO streak-loss drama.
  Milestone toasts only at 7 / 30 / 100 days; ordinary logs get the plain "Logged!" version.
- Reduced motion: fade only, no scale.

## Tone of voice (microcopy)

- Encouraging observer, never coach-with-a-whistle, never guilt: banned patterns — "you failed",
  "you broke your streak", "only X calories left, don't blow it", shame emoji, red for food data.
- Over-target is information, not judgment: "70 kcal over target today" — full stop.
- Insights are observations, not prescriptions: "Protein ran below target on 4 of 7 days" — yes;
  "You should eat more chicken" / any medical framing — no. The API disclaimer ships on every insight.
- Streaks celebrate presence, not perfection: a broken streak resets quietly ("Start a new streak
  today"); we surface `longest_days` as a proud memory, not a loss.
- Voice: short, warm, concrete. Pip may be referenced by name in empty/loading states, sparingly
  (max one Pip mention per screen). Sentence case everywhere, no ALL CAPS except tiny badge labels.
