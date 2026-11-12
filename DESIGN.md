# VGC Helper — design

Every screen follows this file. If a screen needs something this file does not cover, update
this file first, then build the screen.

## 1. Direction: a scouting sheet

VGC Helper should look like a well-kept **scouting sheet**: the kind of printed report a coach
fills in before a match. Dense, ruled, organised in rows and columns, numbers aligned so they
can be compared at a glance. It is a professional tool made by someone who plays.

- **Paper and graphite.** The light theme is warm off-white paper with near-black ink. The dark
  theme is graphite with off-white ink. Both follow the system setting by default.
- **The 18 type colors are the only strong color in the interface.** Everything else is ink,
  paper and hairlines. When color shows up, it means a type.
- **Sprites carry the identity**, not illustrations, gradients or mascots.
- **Information first.** Prefer a table to a card grid, a number to an adjective, and a
  label to an icon.

## 2. Principles

1. **Dense, not cramped.** Use the spacing scale; never squeeze below it. Density is a user
   setting (compact or comfortable), not a per-screen decision.
2. **Numbers line up.** Tabular figures everywhere, right-aligned in tables, same unit per column.
3. **Color is never the only signal.** Every colored thing also has text, a symbol or an icon.
4. **Every number has a source and a date** within reach (inline or one tap away).
5. **Motion explains a change of state.** Nothing moves just to look alive.

## 3. Color

### 3.1 Neutrals and roles

| Token                        | Role                                    | Light                 | Dark                  |
| ---------------------------- | --------------------------------------- | --------------------- | --------------------- |
| `--bg`                       | Page background ("paper")               | `#F6F5F1`             | `#111316`             |
| `--surface`                  | Panels, rows, inputs                    | `#FFFFFF`             | `#191C20`             |
| `--ink`                      | Text, primary action, focus ring        | `#17191C`             | `#EEEDE8`             |
| `--muted`                    | Secondary text, labels                  | `#5B5F66`             | `#A2A6AD`             |
| `--line`                     | Hairlines between rows and panels       | `#DDDAD2`             | `#2C3036`             |
| `--line-strong`              | Borders of inputs and controls          | `#868990`             | `#686E77`             |
| `--danger` / `--danger-bg`   | Errors, illegal choices, severe threats | `#B4132E` / `#FCE8EB` | `#FF8A98` / `#3A1A20` |
| `--warning` / `--warning-bg` | Things to check, approaching deadlines  | `#8A5300` / `#FBF0DC` | `#F2B856` / `#35290F` |
| `--success` / `--success-bg` | Legal, covered, saved                   | `#1E7340` / `#E5F3EA` | `#7FD39A` / `#15301F` |

Measured contrast (WCAG 2.2):

- Ink on paper: 16.1:1 light, 15.9:1 dark. Muted on surface: 6.4:1 light, 7.0:1 dark.
- Danger, warning and success text on the surface: 6.8 / 6.3 / 5.9:1 light, 7.6 / 9.6 / 9.5:1
  dark; on their own tinted backgrounds: at least 5.1:1.
- `--line-strong` against the surface: 3.5:1 light, 3.3:1 dark (non-text minimum is 3:1).
  `--line` is decorative only (rows, panels) and never the only boundary of a control.

**The action color is ink.** Primary buttons are ink with surface-colored text; secondary
buttons are outlined with `--line-strong`; links are ink and underlined. This keeps the type
colors as the only strong color on screen.

**Danger is not Fire.** Danger is a crimson used for text, borders and small marks, always with
an icon and a word ("Illegal", "Weak to"). It is never used as a large fill. The Fire type is an
orange fill with its type name on it.

### 3.2 The 18 type colors

Each type has four values (fill and text, for each theme), computed in OKLCH and checked for contrast:

- **fill**: background of type chips and the type edge (§8). Text on it is `--ink`.
- **text**: the type's color when used for text or thin marks on `--surface`.

| Type     | Light fill (ink 7.0:1) | Light text (4.6:1 on surface) | Dark fill (ink 5.2:1) | Dark text (4.6:1 on surface) |
| -------- | ---------------------- | ----------------------------- | --------------------- | ---------------------------- |
| Normal   | `#AAA48B`              | `#7B755E`                     | `#68624B`             | `#8B856D`                    |
| Fire     | `#FB823A`              | `#C05502`                     | `#A24701`             | `#D86207`                    |
| Water    | `#5DA7F8`              | `#2B77C4`                     | `#1163AE`             | `#3D88D6`                    |
| Electric | `#C0A106`              | `#8A7305`                     | `#746105`             | `#9D8302`                    |
| Grass    | `#5EB755`              | `#2A8622`                     | `#0C7202`             | `#3D9735`                    |
| Ice      | `#43B2BE`              | `#01818C`                     | `#046C75`             | `#14939E`                    |
| Fighting | `#E98A76`              | `#B45B48`                     | `#9E4736`             | `#C66B58`                    |
| Poison   | `#D585E7`              | `#A356B5`                     | `#8F42A0`             | `#B566C6`                    |
| Ground   | `#C99B5A`              | `#986D29`                     | `#845A0F`             | `#A97D3A`                    |
| Flying   | `#8CA5D1`              | `#5E759F`                     | `#4C628A`             | `#6E85B0`                    |
| Psychic  | `#FF74AE`              | `#CC3C80`                     | `#B5226C`             | `#E04E90`                    |
| Bug      | `#92AF34`              | `#667E01`                     | `#556901`             | `#748F05`                    |
| Rock     | `#B6A271`              | `#867343`                     | `#736030`             | `#978353`                    |
| Ghost    | `#BD93E2`              | `#8C63AF`                     | `#79509A`             | `#9D73C0`                    |
| Dragon   | `#979AFE`              | `#6A64E5`                     | `#594FCE`             | `#7974F7`                    |
| Dark     | `#B5A094`              | `#857166`                     | `#715E54`             | `#958176`                    |
| Steel    | `#8DA7B5`              | `#607985`                     | `#4D6571`             | `#6F8996`                    |
| Fairy    | `#C794BB`              | `#96668B`                     | `#815377`             | `#A6769B`                    |

Rules:

- A type chip always shows the type name (or its three-letter abbreviation in compact tables),
  never color alone.
- Do not invent other uses for these colors (no type-colored buttons or page backgrounds).
- The values are generated by a script and checked with WCAG contrast; change them there, not
  by hand, and keep the minimums above.

### 3.3 Data colors

The type matrix is a heat map with the value written in every cell:

| Value | Light                                             | Dark                   | Extra signal |
| ----- | ------------------------------------------------- | ---------------------- | ------------ |
| 4×    | `--danger` text on `--danger-bg`, bold            | same, dark tokens      | bold "4×"    |
| 2×    | `--danger` text on surface, 1 px danger underline | same                   | "2×"         |
| 1×    | `--muted` dot                                     | same                   | "·"          |
| ½     | ink on `#E3EAF0`                                  | ink on `#1E2833`       | "½"          |
| ¼     | ink on `#C9D6E2`, bold                            | ink on `#26384A`, bold | bold "¼"     |
| 0     | ink on diagonal hatch                             | same                   | "0"          |

Stacked weaknesses (3 or more members weak to one type) get a danger mark in the row header and
a sentence in the alert list. Speed tiers use a vertical ruler: ink ticks for the team, muted
ticks for the meta, with the number next to every tick.

## 4. Typography

**Archivo** (variable: weight 100–900, width 62–125), by Omnibus-Type, SIL Open Font License 1.1,
self-hosted from `@fontsource-variable/archivo`. No requests to Google Fonts at runtime.

Why Archivo:

- It is a grotesque made for dense information, with a slightly sporty, scoreboard character
  that fits a competitive game without imitating any official Pokémon type style.
- **True tabular figures** (`tnum`), so stats, damage percentages and speed tiers align.
- The **width axis** lets one family do everything: condensed (wdth 87) for dense tables,
  regular (100) for text, extended (112) for headings and the wordmark. One font file, no pairing.
- Full Latin coverage for Portuguese.
- It is none of the overused defaults (Inter, Roboto, Arial, Geist, Space Grotesk, Instrument
  Serif, Fraunces).

Monospace (Showdown paste import/export only): the system stack
`ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, monospace`. No extra font.

| Token          | Size / line | Weight / width                | Use                                         |
| -------------- | ----------- | ----------------------------- | ------------------------------------------- |
| `--text-micro` | 12 / 16     | 600 / 100, uppercase, +0.06em | Column headers, section labels on the sheet |
| `--text-sm`    | 13 / 18     | 400 / 100                     | Compact body, table cells                   |
| `--text-base`  | 14 / 20     | 400 / 100                     | Body text                                   |
| `--text-lead`  | 16 / 24     | 400 / 100                     | Explanations, empty states                  |
| `--text-h3`    | 18 / 24     | 650 / 100                     | Panel titles                                |
| `--text-h2`    | 22 / 28     | 700 / 108                     | Screen sections                             |
| `--text-h1`    | 28 / 32     | 750 / 112                     | Screen title, wordmark                      |

- `font-variant-numeric: tabular-nums` on every element that shows numbers.
- Table cells use width 87 in compact density.
- Line length for running text: 60–75 characters.

## 5. Spacing, radius, borders

Spacing scale (4 px grid): `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64` px, tokens
`--space-0` … `--space-12`. Mobile side gutter: 16 px.

| Element                           | Radius |
| --------------------------------- | ------ |
| Tables, the type matrix, rows     | 0      |
| Inputs, buttons, chips, kbd hints | 4 px   |
| Panels, dialogs, popovers, menus  | 6 px   |

Nothing larger than 6 px. **Hairline borders instead of shadows**: elevation is a surface color
plus a 1 px border. Popovers and menus use `--line-strong` and no shadow.

## 6. Density

|                  | Comfortable (default) | Compact |
| ---------------- | --------------------- | ------- |
| Table row height | 36 px                 | 28 px   |
| Control height   | 36 px                 | 28 px   |
| Body text        | 14 px                 | 13 px   |
| Table width axis | 100                   | 87      |

On touch screens (`pointer: coarse`) every tap target is at least 44 × 44 px in both densities.
Beginners get more explanation (inline glossary, sentences); advanced users get more numbers per
screen. The density and the experience level are separate settings.

## 7. Layout

- **Desktop (≥ 1200 px):** three columns. Team slots (280 px) · slot editor (flexible) ·
  live analysis (380 px). The analysis column scrolls on its own.
- **Tablet (768–1199 px):** team + editor; the analysis opens as a side panel.
- **Phone (< 768 px):** one column with a bottom tab bar, "Team" and "Analysis", 56 px tall.
  New alerts show a count on the Analysis tab.
- Headers are thin (48 px): wordmark, format and regulation selector, command palette hint
  (`Ctrl K`), settings. No hero sections, no marketing page.

## 8. Signature detail: the type edge

Every Pokémon shown anywhere (team slot, search result, threat row, meta table, speed tick) has a
**4 px edge on its left side, split top and bottom between its two types** (a single-type
Pokémon gets one solid edge). It reads like the colored tab of a file card in a scouting
binder, makes a whole team's type spread scannable from across the screen, and is the one
decorative element of the interface. The type names are always written next to it.

## 9. Motion

- Durations: 120 ms (hover, press, toggle), 160 ms (panel open, tab change).
- Easing: `cubic-bezier(0.2, 0, 0, 1)`. No bounce, no spring overshoot.
- Only state changes animate: a panel opening, an alert appearing in place, a row being
  reordered. No entrance animations on page load, no fade-up on scroll, no counters that count
  up, no shimmering skeletons (skeletons are static).
- `prefers-reduced-motion: reduce` sets every duration to 0.

## 10. Components and states

- **Buttons:** primary (ink), secondary (outline), quiet (text only). Labels are verbs
  ("Add Pokémon", "Explain", "Import"), no arrows, no exclamation marks.
- **Chips:** type chips (fill + name), role chips (outline + name, e.g. "Fake Out", "Tailwind").
- **Alerts:** icon + short title + one sentence + source/date. Severity: danger, warning, info.
  New alerts are announced with `aria-live="polite"`.
- **Glossary:** jargon (Fake Out, Trick Room, spread…) has a dotted underline and a tooltip;
  beginners see it on every occurrence, others on the first.
- **Keyboard:** command palette (`Ctrl K`), `1`–`6` select a slot, `?` lists shortcuts, `Esc`
  cancels, `Ctrl Z` undoes. Shortcuts appear in tooltips as `kbd` hints.
- **Loading:** skeletons with the shape of the content, static.
- **Empty states teach:** "Add your first Pokémon or paste a team from Showdown."
- **Errors say how to fix:** what happened, why, and the next step.
- **Focus:** always visible, 2 px `--ink` outline with a 2 px offset.
- Headless primitives (Radix UI) for dialogs, menus, tabs, tooltips and popovers, styled with
  these tokens. Never the default look of any component library.

## 11. Icons, sprites and logo

- **Icons:** Lucide (ISC license), 16 px in tables, 20 px elsewhere, 1.75 px stroke, always next
  to a text label or with an `aria-label`. Never inside a rounded square, never decorative.
- **Sprites:** loaded at runtime from a configurable URL once permission from Smogon is
  confirmed; never committed to the repository. Until then, a placeholder: the type edge plus
  the species' initials in `--muted`, on the plain surface.
- **Logo:** an original mark of two parallelograms side by side, leaning right — the two
  Pokémon on the field in Doubles — in ink, followed by the wordmark "VGC Helper" in Archivo
  width 112, weight 750. No Poké Ball, no official art, no lettering that imitates the games.

## 12. Writing

Short, direct sentences. Numbers instead of adjectives. No exclamation marks, no marketing words
(Elevate, Seamless, Powerful, Unlock, Supercharge, Potencialize, Turbine). Pokémon, move, item
and ability names in English; everything else in the selected language.

## 13. Never

- Purple, blue or indigo gradients; gradient text; glassmorphism; decorative blur; glows.
- The default shadcn look (default neutral palette, `rounded-2xl` + `shadow-lg` on everything).
- Inter, Roboto, Arial, Geist, Space Grotesk, Instrument Serif, Fraunces.
- Icons in rounded squares, emoji in the interface, the "sparkles" icon for AI.
- The same fade-up on every block, bouncing animations, numbers that count up.
- Marketing copy, exclamation marks, an arrow on every button.
- A centered hero with three cards, decorative 01/02/03 numbering, fake macOS window dots.
- Official Pokémon UI, logos or art; a Poké Ball as a logo.

## 14. Checking a screen

Before showing a screen:

1. Playwright screenshots: desktop and phone, light and dark.
2. Compare them with this file and with §13.
3. axe with WCAG 2.2 AA tags: no violations.
4. Keyboard-only pass: every action reachable, focus always visible.
5. `prefers-reduced-motion` on: nothing moves.

## 15. Tokens in code

The tokens live as CSS custom properties in `apps/web/src/styles/tokens.css` (`:root` for
light, `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` for dark) and are exposed
to Tailwind through `@theme`. Components use the tokens, never raw hex values.
