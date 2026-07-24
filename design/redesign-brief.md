# Helsa v2 — CalAI-style design brief

Distilled from `benchmark/calai/` (34 screenshots of Cal AI's onboarding + plan screens).
This supersedes the previous mascot-centric design; the mascot SVGs are retired.

## Design language

- **Canvas**: near-white `#FAFAFA` page, subtle white→`#F2F2F5` gradient toward the bottom.
  Cards: pure white, 1px border `#ECECF0`, radius 24px (`rounded-3xl`), no/faint shadow.
- **Ink**: near-black `#16161A` for headings and primary buttons; `#8E8E96` secondary text.
- **Type**: system/Inter. Screen titles huge and bold (~30–34px, tracking-tight, 1.15 line
  height), gray 17px subtitle under them. Numbers (calories, weights) extra bold and large.
- **Buttons**: full-width pill (`rounded-full`) black CTA, white text, ~56px tall, sticky at
  bottom above safe area; disabled = `#D9D9DE`. Secondary action = plain text button below.
- **Option cards** (wizard + pickers): white card, icon in a pale `#F4F4F8` circle chip on
  the left, 17px label, radio circle on the right. Selected: 2px black border + filled black
  radio dot. One column, 12px gaps.
- **Wizard chrome**: circular pale back button (arrow-left) top-left, thin rounded progress
  bar filling per step, then title + subtitle.
- **Segmented unit toggles** (kg/lbs, cm/ft-in): pill container `#F1F1F4`, white raised
  active segment.
- **Accent**: warm peach `#E8A87C` used *sparingly* (recommended labels, highlights, trophy
  moments). Blue `#4A7DFF` only for links/info chips. Macro colors: protein `#E36A6A`,
  carbs `#E8A13C`, fat `#5B8DEF`, calories = black flame.
- **Icons**: lucide-react everywhere, 1.5px stroke, currentColor.
- **3D vectors**: local, hand-built SVG illustrations with soft radial/linear gradients,
  highlights and drop shadows for a claymorphic "3D sticker" look (flame, avocado/apple,
  dumbbell, droplet, moon/diary, cigarette-free lungs, trophy). Stored under
  `frontend/src/assets/illustrations/` as React components. No external image fetches.
- **Charts**: minimal — thin black line with soft gray gradient fill, dotted guide lines,
  round white dots with black stroke at endpoints (see weight-trend screenshots). No grids,
  no axis clutter.
- **Motion**: 150–250ms ease-out; number count-ups on plan reveal; progress % screen when
  generating the plan.

## Information architecture

- `/welcome` — hero illustration, "Calorie tracking made easy" style headline, Get Started
  pill, "Already have an account? Sign In".
- `/onboarding` — pre-auth wizard, state kept client-side, one question per screen:
  sex → workouts/week (0-2 / 3-5 / 6+ maps to activity_level light/moderate/active) →
  birth date → height + weight (unit toggles; metric stored) → goal (lose/maintain/gain) →
  target weight (skipped for maintain) → pace slider 0.1–1.5 kg/wk with sloth/rabbit/bolt
  markers + "Recommended 0.5" → diet → "generating your plan" (animated %, checklist) →
  plan reveal ("Goal: lose 7 kg by <date>", estimated-progress curve, daily recommendation
  cards: big calorie card + 3 macro cards with colored icons, Your-info list) →
  "Save your progress" → register. After register: PUT /me/profile with wizard answers,
  then into the app.
- `/app` (bottom nav, 5 slots): **Home**, **Progress**, center **+** (opens a log sheet:
  Food / Workout / Weight / Diary / Habit quick-log), **Diary**, **Profile**.
  - **Home**: date + streak flame chip; calories-left ring card (big number, flame icon);
    three macro mini-cards with tinted ring progress; habits row (per habit: icon, today
    count vs target, tap = +1 with undo toast); today's workouts (burned calories chip);
    today's food log list grouped list; diary nudge card when empty.
  - **Log food**: search-first (existing FTS flow restyled), suggestions chips (recent /
    favorites / popular), custom food form, detail sheet with serving picker + quantity
    stepper.
  - **Progress**: period tabs (D/W/M) + date nav; weight trend chart with target dashed
    line; calories vs target bars; macro averages vs targets with delta chips; habit
    adherence rows; AI insight card (sparkle icon, disclaimer footnote); export button.
  - **Diary**: mood 1–5 (emoji-style faces) + energy 1–5 selectors, note textarea,
    autosaved per day; past entries list.
  - **Profile**: plan card (edit goal/pace/targets re-runs relevant wizard steps as
    sheets), account (name, timezone, password), habits management (add/archive), export,
    logout.

## Engineering ground rules

- React 18 + Vite + TS strict, Tailwind v4 tokens via CSS variables, shadcn/ui primitives,
  TanStack Query for all IO (`lib/queries.ts`), react-router v7. No new heavy deps;
  recharts stays for charts.
- All date logic in the user's timezone; API types mirror `docs/api-contract.md` exactly.
- A11y: real buttons/labels, focus-visible rings, ≥44px touch targets, AA contrast.
- Mobile-first (390px design width), works to desktop (max-w-md centered shell).
