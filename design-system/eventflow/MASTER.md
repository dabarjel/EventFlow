# EventFlow Design System: Studio

> **Source of truth for values:** [`css/tokens.css`](../../css/tokens.css). This file explains how to use
> them. If the two disagree, the tokens file wins and this file needs updating.
>
> **Page overrides:** if `design-system/eventflow/pages/<page>.md` exists, its rules override this file
> for that page.

**Project:** EventFlow, the proposal and booking tool for DaVinci's Florist (DC, MD, VA)
**Direction:** D "Studio", chosen 2026-09-30 from the four options in `styleguide.html`
**Replaces:** "Quiet Botanical Luxury" (light ivory app with Playfair headings), retired in Phase 2

---

## Two surfaces, two themes

| Surface | Theme | Why |
|---|---|---|
| **App screens**: dashboard, builder, inventory, CRM, pipeline, calendar, invoices list, contracts list, Venue Visualizer | Dark "Studio" | A working tool used all day. Restraint, density and fast scanning. DaVinci's real brand is black and white. |
| **Client documents**: the proposal sheet, invoice preview, contract template, and anything printed or exported to PDF | Light, Playfair, brass | What the client sees. It should read like a printed piece from a high-end florist. |

Document containers (`#printable-proposal`, `#invoice-preview`, `#contract-template-text`, `.doc-theme`)
remap the semantic tokens to the light palette, so components placed inside them render light.

**Never tokenize document markup or print strings.** The proposal "Download PDF" window and the invoice
print window are blank windows that load none of our CSS. Their HTML (`renderProposalDoc`, `showInvoice`)
and their CSS strings (`generatePDF`, `printInvoicePreview`) must keep literal colors, fonts and sizes.
A `var(--token)` there is undefined and breaks the printout.

---

## Color

All values are in `css/tokens.css`. Contrast ratios are WCAG, measured against `--surface` (#1B1B1B) unless noted.

### Surfaces and borders

Layered near-black, separated by 1px borders. **No drop shadows on cards.**

| Token | Value | Use |
|---|---|---|
| `--bg` | #141414 | Page, sidebar, input wells |
| `--surface` | #1B1B1B | Cards, tables, panels, modals |
| `--surface-raised` | #232323 | Table headers, totals, secondary buttons |
| `--surface-hover` | #1F1F1F | Faint hover on nav rows and list rows |
| `--surface-active` | #262626 | Selected nav row, pressed state |
| `--border` | #2E2E2E | Default 1px divider between layers |
| `--border-strong` | #3A3A3A | Buttons, chips, emphasized edges |
| `--border-input` | #6B6B6B | Form field edges. 3.23:1 on surface, 3.46:1 on bg (needs 3:1) |
| `--photo-well` | #F2F2F2 | Behind catalog photos, which are shot on white |
| `--overlay` | rgba(0,0,0,.6) | Modal and drawer scrim |

### Text

| Token | Value | Contrast | Use |
|---|---|---|---|
| `--text` | #EDEDED | 13.4:1 | Primary text, values, titles |
| `--text-2` | #A3A3A3 | 6.2:1 on raised | Secondary text |
| `--text-3` | #8F8F8F | 4.86:1 on raised | Muted labels, metadata, helper text |
| `--text-4` | #6E6E6E | 3.38:1 | **Decoration and disabled only.** Never readable text. |

### Accent: one color, used sparingly

Set with `data-accent` on `<html>`. Champagne gold is the default. Botanical green is the alternative.

| Token | Gold (default) | Green | Use |
|---|---|---|---|
| `--accent` | #CDAE73 | #3F7A5A | Fill of the primary button |
| `--accent-hover` | #D8BD88 | #478663 | |
| `--accent-on` | #17130A (8.73:1) | #FFFFFF (5.07:1) | Text on the fill |
| `--accent-text` | #CDAE73 (8.12:1) | #7DB896 (7.52:1) | Accent as text or icon on dark; focus edge of fields |
| `--accent-border` | #B8995E | #4F8C6A | |

The accent appears **only** on: the primary action, the active nav icon, and key status. Never use it
for decoration, headings, totals or large areas. On green, `--accent` fails as text on dark (3.4:1):
always use `--accent-text` for text and icons.

### Semantic

| Purpose | Text | Background | Solid fill (white text) |
|---|---|---|---|
| Danger | `--danger-text` #F1A39C | `--danger-bg` #2A1716 | `--danger` #B3261E (6.54:1) |
| Success | `--success-text` #86D1A6 | `--success-bg` #16301F | `--success` #276B4C (6.38:1) |
| Info | `--info-text` #93BDEB | `--info-bg` #172636 | `--info` #2F6290 (6.42:1) |
| Warning | `--warning-text` #E3C17E | `--warning-bg` #30271A | |

Invalid field edge: `--danger-border` #E5655C (5.21:1).

### Proposal status

The badges map to the four states the app stores. **Color only appears on badges**, always with a dot
and a word.

| Status | Text | Background | Contrast |
|---|---|---|---|
| Draft | #B5B5B5 | #2A2A2A | 7.0:1 |
| Sent | #93BDEB | #172636 | 7.8:1 |
| Approved | #C3B2F2 | #272040 | 8.0:1 |
| Complete | #86D1A6 | #16301F | 7.9:1 |

Pipeline and booking states that aren't proposal statuses use `--status-pending-*` (contract out,
partial day) and `--status-declined-*` (cancelled). "Viewed" and "Paid" are not app states yet. Adding
them needs a data model change.

---

## Typography

| Font | Token | Where |
|---|---|---|
| Inter | `--font-sans` | All app UI |
| IBM Plex Mono | `--font-mono` | **Only** small uppercase labels above stat values and metadata (`--fs-2xs`, `--tracking-label`) |
| Playfair Display | `--font-display` | **Only** client documents. Never on app screens. |

`--font-heading` resolves to Inter on app screens and to Playfair inside document containers.

**Scale:** `--fs-2xs` 11 · `--fs-xs` 12 · `--fs-sm` 13 · `--fs-md` 14 (base) · `--fs-lg` 16 · `--fs-xl` 20 ·
`--fs-2xl` 24 · `--fs-3xl` 30. App UI is 13–14px.

**Two weights only:** `--weight-regular` 400 and `--weight-medium` 500. No 600/700 and no all-bold headers
on app screens. Documents keep their own weights.

**Numbers** use tabular figures (set on `body`) and are right-aligned in tables.

**Case:** sentence case for labels, buttons and headings. Uppercase only for the mono labels.

---

## Spacing, radius, elevation, motion

- **Spacing:** 4px grid, `--space-1` 4 up to `--space-16` 64.
- **Radius:** `--radius-xs` 4 (tags) · `--radius-sm` 6 (buttons, inputs, badges, nav rows) · `--radius-md` 8
  (cards, panels, tables) · `--radius-lg` 12 (modals, drawers, document sheet) · `--radius-full` (avatars, dots).
- **Elevation:** borders separate layers. `--shadow-overlay` is only for floating layers: menus,
  popovers, modals and drawers. No glow, no gradients.
- **Motion:** hover and press feedback, plus drawer open and close. Nothing else animates.
  `--duration-fast` 150ms, `--ease-standard`. Under `prefers-reduced-motion` all transitions and
  animations are disabled (`tokens.css`).

---

## Layout

- **Sidebar:** a 52px icon rail (`--rail-collapsed`) that expands to 220px (`--rail-expanded`) over the
  content on hover or keyboard focus, and can be pinned open with a toggle at its foot. Rows are 32px:
  one icon plus a plain label. Hover gets a faint background. Active gets `--surface-active`, white text
  and an `--accent-text` icon, with no colored pill. Groups are separated by thin dividers, not headings.
- **Mobile (below 640px):** a top bar plus a five-tab bottom bar (Home, Proposals, Inventory, Clients,
  More), and a 36px (`--control-h-touch`) floating "New proposal" button. Nothing scrolls sideways
  except tables, inside their own container.
- **Top bar:** page title (Inter 500, `--fs-xl`) and at most one primary action.

---

## Components

**Buttons:** 30px tall (`--control-h`), 28px for small, 13px text, `--radius-sm`, 1px border.
- Primary: `--accent` fill. **One per screen.**
- Secondary: `--surface-raised` fill with a `--border-strong` border.
- Ghost: no border, `--text-2`.
- Destructive: `--danger-bg` fill, `--danger-text`, `--danger-border-subtle`. Always confirm first.
- Labels are sentence case, with an optional 16px leading icon. No trailing arrows.

**Inputs:** 32px tall, `--bg` well, `--border-input` edge, `--ring` on focus. Labels sit above and stay
visible. Errors go under the field and say what to type.

**Stat tiles:** a 32px bordered square holding a 16px icon, a mono label, an Inter 500 value
(`--fs-2xl`) and one line of context. One optional dot-grid texture on a single dashboard panel. Nowhere
else.

**Tables:**
- Numbers are right-aligned with tabular figures.
- Headers are sticky.
- Row actions go in a three-dot menu.
- On mobile, tables scroll horizontally inside their container, with the first column frozen.
- No bento layouts for tables or the builder.

**Loading and empty states:**
- Every place that loads data shows a skeleton while loading.
- Empty states are designed: what this is, plus one clear action. "No proposals yet. Build your first
  one." beats a blank area.
- Errors say what went wrong and how to fix it.

**Icons:** Lucide only, 1.5px stroke, 16–18px. **No Unicode or emoji icons** (◉ ✦ ⬡ 🗑 ✏️ and so on).

**Catalog photos** sit in a light `--photo-well`, `object-fit: contain`, so studio shots aren't cropped.
A missing photo shows the category icon and "No photo yet".

---

## Screen principles (Phases 2 and 3)

- **Dashboard:** clear hierarchy. Top-left holds the most important number: upcoming events, or
  proposals waiting on the client. Include a "Needs attention / Next up" list. Use bordered stat tiles.
  Every number comes from Supabase, or the tile shows an honest empty state.
- **Progressive disclosure:** show the essentials and put secondary options behind a click.
- **One primary action per screen.** Everything else is secondary or ghost.

---

## Client documents

- **Proposal sheet:** white paper on the dark desk, Playfair headings, brass (#9C6B1F) rules and totals,
  green (#1F3D2B) accents.
- **Print and PDF:** must stay pixel-identical when app styles change. The app's `@media print` forces a
  light page (`color-scheme: light`, white background).
- **Document tokens:** `--doc-paper`, `--doc-bg`, `--doc-ink`, `--doc-ink-2`, `--doc-muted`,
  `--doc-border`, `--doc-green`, `--doc-brass`, `--doc-brass-text`.

---

## Accessibility checklist

- [ ] Text ≥ 4.5:1, field edges and large text ≥ 3:1 (ratios above)
- [ ] Visible focus: 2px `--focus-ring` outline on everything focusable
- [ ] Status never by color alone (dot plus word)
- [ ] Keyboard reaches every action. No click-only `div`s.
- [ ] `prefers-reduced-motion` respected
- [ ] Works at 375, 768 and 1440px with no page-level horizontal scroll

## Don't

Gradients · glow · large shadows · colored pills for the active nav item · more than one accent ·
accent as decoration · Playfair on app screens · 600/700 weights in the app · uppercase outside mono
labels · Unicode or emoji icons · bento grids for tables or the builder · tokens inside print strings
or document markup.

---

## Legacy variable names (removed in Phase 2)

For reading older commits. Each old name was split by how it was used:

| Old | New |
|---|---|
| `--cream` / `--warm-white` / `--champagne` | `--bg` / `--surface` / `--surface-raised` |
| `--sage` | `--accent` (fills) · `--accent-text` (text, borders, focus) |
| `--sage-dark` | `--text` (text) · `--accent-hover` (fills) · `--accent-border` (borders) |
| `--sage-light` | `--surface-active` |
| `--champagne-dark` | `--accent-text` · `--accent` · `--accent-border` |
| `--charcoal` / `--charcoal-mid` / `--stone` / `--stone-light` | `--text` / `--text-2` / `--text-3` / `--text-3` or `--text-4` |
| `--border` / `--border-mid` | `--border` / `--border-strong` |
| `--blush` / `--blush-mid` | `--danger-bg` / `--danger-text` · `--danger` · `--danger-border` |
| `--status-viewed-*` / `--status-confirmed-*` / `--status-completed-*` | `--status-pending-*` / `--success-*` / `--status-complete-*` |
| `--radius` / `--shadow-sm,md` / `--shadow-lg,xl` / `--font-serif` | `--radius-md` / none / `--shadow-overlay` / `--font-heading` |
