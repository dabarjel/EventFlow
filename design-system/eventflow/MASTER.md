# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** EventFlow (for DaVinci's Florist)
**Generated:** 2026-07-07
**Category:** Event Services — Proposal Builder & Booking Management Tool (Luxury)

**Curation note:** This file was generated with `ui-ux-pro-max --design-system` and then hand-tuned.
The raw tool output matched a "Wedding/Event Landing Page" pattern with a pink/gold "Liquid Glass" style —
correct for a florist's *marketing site*, wrong for EventFlow, which is an **internal, data-dense working
tool** (booking lists, line-item pricing tables, forms) that also has to **produce a luxury client-facing
document** (the proposal/quote). The palette, patterns, and components below were re-authored to serve both
jobs: a calm, legible app shell for the florist, and an editorial, premium look for anything the client sees.

---

## Global Rules

### Color Palette — App Core

| Role | Hex | CSS Variable | Contrast Check |
|------|-----|--------------|-----------------|
| Primary (deep botanical green) | `#1F3D2B` | `--color-primary` | 11.9:1 on white ✓ AAA |
| On Primary | `#FFFFFF` | `--color-on-primary` | — |
| Secondary (sage) | `#4A6741` | `--color-secondary` | 6.4:1 on white ✓ AA |
| On Secondary | `#FFFFFF` | `--color-on-secondary` | — |
| Accent/CTA (brass gold) | `#9C6B1F` | `--color-accent` | 4.6:1 on white ✓ AA |
| On Accent | `#FFFFFF` | `--color-on-accent` | — |
| Background (warm ivory) | `#FAF7F2` | `--color-background` | — |
| Foreground (warm charcoal) | `#2A2822` | `--color-foreground` | 13.7:1 on bg ✓ AAA |
| Card | `#FFFFFF` | `--color-card` | — |
| Card Foreground | `#2A2822` | `--color-card-foreground` | — |
| Muted (warm greige) | `#F0ECE3` | `--color-muted` | — |
| Muted Foreground | `#6B6455` | `--color-muted-foreground` | 4.98:1 on muted ✓ AA |
| Border | `#E4DFD3` | `--color-border` | — |
| Destructive | `#B3261E` | `--color-destructive` | 5.9:1 on white ✓ AA |
| On Destructive | `#FFFFFF` | `--color-on-destructive` | — |
| Ring (focus) | `#1F3D2B` | `--color-ring` | — |

**Notes:** Deep botanical green + brass gold reads as "artisan luxury," not "wedding pastel." Ivory
background keeps long working sessions (building a proposal, scanning a booking table) easy on the eyes.
Gold is reserved for primary CTAs and premium accents — never used for large text blocks (borderline
contrast at small sizes).

### Status / Semantic Colors (Bookings & Proposals)

Booking and proposal status is core to the product — always pair color with an icon or label text
(`color-not-only`), never color alone.

| Status | Text | Background | CSS Variable |
|--------|------|------------|--------------|
| Draft | `#8A8374` | `#F0ECE3` | `--status-draft` |
| Sent / Pending | `#3B6E91` | `#E8F0F5` | `--status-sent` |
| Viewed | `#A6742D` | `#F5EEDD` | `--status-viewed` |
| Accepted / Confirmed | `#2F7D5A` | `#E6F2EC` | `--status-confirmed` |
| Declined / Cancelled | `#B3261E` | `#FBEAE9` | `--status-declined` |
| Completed | `#1F3D2B` | `#E9EFEA` | `--status-completed` |

### Typography

- **Heading Font:** Playfair Display — used for the app's brand moments *and* everywhere on the
  client-facing proposal document (cover title, section headers, event name). This is what makes a
  quote feel like it came from a florist, not a spreadsheet.
- **Body / UI Font:** Inter — used for all functional UI: nav, forms, tables, buttons, booking lists.
  Legible at small sizes, holds up in dense tables.
- **Mood:** elegant, artisan, editorial, precise — luxury without being fussy.
- **Google Fonts:** [Playfair Display + Inter](https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
```

**Type Scale:**

| Token | Size | Font | Usage |
|-------|------|------|-------|
| `--text-display` | 40px / 2.5rem | Playfair Display 600 | Proposal cover title, event name |
| `--text-h1` | 28px / 1.75rem | Playfair Display 600 | Page titles ("Bookings", "New Proposal") |
| `--text-h2` | 22px / 1.375rem | Playfair Display 500 | Section headers (Furniture, Florals, Pricing) |
| `--text-h3` | 17px / 1.0625rem | Inter 600 | Card titles, table group headers |
| `--text-body` | 16px / 1rem | Inter 400 | Default body / form text |
| `--text-small` | 14px / 0.875rem | Inter 400 | Table cells, helper text, metadata |
| `--text-micro` | 12px / 0.75rem | Inter 500 | Status badges, timestamps |

Numbers (prices, quantities, dates in tables) use `font-variant-numeric: tabular-nums` so columns
align — critical for pricing tables that are the core deliverable.

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` | Tight gaps, icon-to-label |
| `--space-sm` | `8px` | Inline spacing, table cell padding-y |
| `--space-md` | `16px` | Standard padding, form field gaps |
| `--space-lg` | `24px` | Card padding, section padding |
| `--space-xl` | `32px` | Section gaps |
| `--space-2xl` | `48px` | Page-level section margins |
| `--space-3xl` | `64px` | Proposal document section breaks |

### Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `6px` | Inputs, badges, table row hover |
| `--radius-md` | `10px` | Buttons, cards |
| `--radius-lg` | `16px` | Modals, proposal document sheet |

Moderate radius only — sharp enough to feel precise/editorial, soft enough to feel warm. Avoid
fully-rounded (pill) buttons except for status badges.

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(31,61,43,0.06)` | Table row hover, subtle lift |
| `--shadow-md` | `0 4px 10px rgba(31,61,43,0.08)` | Cards, dropdowns |
| `--shadow-lg` | `0 12px 24px rgba(31,61,43,0.12)` | Modals, popovers |
| `--shadow-xl` | `0 24px 48px rgba(31,61,43,0.16)` | Proposal preview sheet, mockup lightbox |

Shadows are tinted with the primary green (not pure black) and kept soft — no glassmorphism, no
heavy blur. This is a working tool with lots of tables; effects must never compete with data legibility.

---

## Component Specs

### Buttons

```css
.btn-primary {
  background: #1F3D2B;
  color: #FFFFFF;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: var(--text-body);
  transition: background 150ms ease, transform 150ms ease;
  cursor: pointer;
}
.btn-primary:hover { background: #2A4F38; }
.btn-primary:active { transform: translateY(1px); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }

/* Use sparingly — send proposal, confirm booking, accept quote */
.btn-accent {
  background: #9C6B1F;
  color: #FFFFFF;
  padding: 12px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: background 150ms ease;
  cursor: pointer;
}
.btn-accent:hover { background: #86591A; }

.btn-secondary {
  background: transparent;
  color: #1F3D2B;
  border: 1.5px solid #1F3D2B;
  padding: 10.5px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  transition: background 150ms ease;
  cursor: pointer;
}
.btn-secondary:hover { background: #F0ECE3; }

.btn-ghost {
  background: transparent;
  color: #6B6455;
  padding: 10.5px 16px;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
}
.btn-ghost:hover { background: #F0ECE3; color: #2A2822; }

.btn-destructive {
  background: transparent;
  color: #B3261E;
  border: 1.5px solid #B3261E;
  padding: 10.5px 20px;
  border-radius: var(--radius-md);
  font-weight: 600;
  cursor: pointer;
}
```

Every screen has exactly one primary action (`btn-primary` or `btn-accent`); everything else is
secondary/ghost. Destructive actions (delete booking, cancel proposal) always require a confirmation
dialog.

### Cards (App Chrome)

```css
.card {
  background: #FFFFFF;
  border: 1px solid #E4DFD3;
  border-radius: var(--radius-md);
  padding: var(--space-lg);
  box-shadow: var(--shadow-sm);
  transition: box-shadow 150ms ease;
}
.card:hover { box-shadow: var(--shadow-md); }
```

### Proposal Document Sheet (Client-Facing)

The proposal/quote is the product's signature deliverable — it should read like a printed piece from
a high-end florist, not an app screen. Render it on its own "paper" surface, separate from app chrome.

```css
.proposal-sheet {
  background: #FFFFFF;
  color: #2A2822;
  max-width: 840px;
  margin: 0 auto;
  padding: var(--space-3xl) var(--space-2xl);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
}
.proposal-sheet .cover-title {
  font-family: 'Playfair Display', serif;
  font-size: var(--text-display);
  font-weight: 600;
  color: #1F3D2B;
}
.proposal-sheet .section-divider {
  border-top: 1px solid #E4DFD3;
  margin: var(--space-2xl) 0;
}
.proposal-sheet .mockup-image {
  border-radius: var(--radius-md);
  width: 100%;
  object-fit: cover;
  aspect-ratio: 16 / 10;
}
```

Print/PDF export: use `@media print` to strip `.app-shell` chrome entirely and print only
`.proposal-sheet` at full width with shadows removed — a client should be able to print or save a
clean PDF of just the proposal.

### Data Table (Bookings, Line Items, Pricing)

```css
.data-table { width: 100%; border-collapse: collapse; font-size: var(--text-small); }
.data-table th {
  text-align: left;
  font-weight: 600;
  color: #6B6455;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid #E4DFD3;
  position: sticky;
  top: 0;
  background: #FAF7F2;
}
.data-table td {
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid #F0ECE3;
  font-variant-numeric: tabular-nums;
}
.data-table tr:hover td { background: #F0ECE3; }
.data-table .price-col { text-align: right; font-weight: 500; }
```

Line-item tables (furniture, florals, pricing) support inline quantity edit and per-row subtotal;
totals row is visually separated (`border-top: 2px solid var(--color-primary)`), never just bolded.

### Status Badge

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--text-micro);
  font-weight: 600;
}
/* color/background pulled from Status/Semantic table above, e.g.: */
.status-badge.confirmed { color: #2F7D5A; background: #E6F2EC; }
```

Always paired with a small dot or icon (not color alone) so status is distinguishable for
colorblind users and in any exported/printed view.

### Inputs

```css
.input {
  padding: 11px 14px;
  border: 1px solid #E4DFD3;
  border-radius: var(--radius-sm);
  font-size: 16px;
  background: #FFFFFF;
  color: #2A2822;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.input:focus {
  border-color: #1F3D2B;
  outline: none;
  box-shadow: 0 0 0 3px rgba(31,61,43,0.15);
}
.input::placeholder { color: #9C9686; }
```

Labels are always visible above the field (never placeholder-only). Currency/price inputs are
right-aligned with tabular numerals and a fixed `$` prefix.

### Modals / Dialogs

```css
.modal-overlay { background: rgba(42,40,34,0.55); }
.modal {
  background: #FFFFFF;
  border-radius: var(--radius-lg);
  padding: var(--space-xl);
  box-shadow: var(--shadow-xl);
  max-width: 520px;
  width: 90%;
}
```

Confirm before dismissing a modal with unsaved proposal edits.

### Sidebar Navigation (App Shell)

```css
.sidebar {
  background: #FFFFFF;
  border-right: 1px solid #E4DFD3;
  width: 240px;
}
.sidebar .nav-item {
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  color: #6B6455;
  font-weight: 500;
  font-size: var(--text-small);
}
.sidebar .nav-item.active {
  background: #F0ECE3;
  color: #1F3D2B;
  font-weight: 600;
}
```

---

## Style Guidelines

**Style Name:** Quiet Botanical Luxury (Editorial × Data-Dense hybrid)

Synthesized from two tool matches — *Editorial Grid/Magazine* (for the proposal document) and
*Data-Dense Dashboard* (for the booking/proposal-builder app screens) — unified under one palette
and type system instead of using either at face value.

**Keywords:** botanical, artisan, editorial, precise, warm-neutral, quiet, tactile paper feel

**Best For:** Luxury service businesses, bespoke/quote-driven B2B tools, florists, event planners,
boutique studios.

**Key Effects:** Soft green-tinted shadows (no pure black), 150–250ms ease transitions, tabular
numerals in all pricing/data columns, sticky table headers, subtle row-hover highlight. No
glassmorphism, no heavy blur, no decorative motion — legibility and speed matter more than flourish
in a tool the florist uses all day.

### Page Patterns

**1. App Shell / Dashboard** (Bookings list, Proposal Builder, Settings)

- Persistent left sidebar (240px) — Dashboard, Bookings, Proposals, Clients, Settings.
- Top bar: page title (Playfair Display h1) + primary action button, right-aligned.
- Content: data tables and cards on ivory background; white cards for grouped content.
- Booking/proposal rows show a status badge, client name, event date, and total — sortable columns.
- Empty states use a small botanical line-illustration + one clear CTA ("Create your first proposal").

**2. Proposal Builder** (multi-step, the core feature)

- Left: step list (Event Details → Furniture → Florals → Pricing → Timeline → Mockup → Review) with
  progress indicator; back navigation always available (`escape-routes`).
- Right: live preview of the proposal document as it's built, reflecting the `.proposal-sheet` style
  — the florist should always see what the client will see.
- Autosave draft on every step change (`form-autosave`) — florists build these over multiple sittings.
- Line-item sections (furniture, florals) use the Data Table spec with add/remove rows and running
  subtotal; pricing step shows a totals summary with tax/discount lines, tabular-aligned.

**3. Proposal Document (Client View)**

- Full `.proposal-sheet` treatment: cover with event name/date/mockup image, itemized sections with
  photos where relevant, timeline as a simple vertical stepper, total investment, accept/decline CTA.
- This is the one place `--color-accent` (brass gold) and Playfair Display get to be prominent —
  it is the client-facing "brand moment."

---

## Anti-Patterns (Do NOT Use)

- ❌ Liquid Glass / heavy glassmorphism, animated blur, chromatic aberration — kills legibility in
  data-dense tables and hurts performance on long booking/pricing lists.
- ❌ Romantic pink/pastel palettes — reads as generic "wedding site," undercuts the artisan-luxury
  positioning of DaVinci's Florist.
- ❌ Oversized/exaggerated typography (`clamp(3rem, 10vw, 12rem)`) — this is a working tool and a
  client document, not a landing page hero.
- ❌ Emojis as icons — use SVG icons (Phosphor or Heroicons), one consistent set, consistent stroke
  weight.
- ❌ Missing `cursor: pointer` on clickable elements.
- ❌ Color-only status indicators — every status badge pairs color with a label/icon.
- ❌ Non-tabular numerals in price/quantity columns — columns must align.
- ❌ Instant state changes — always transition 150–300ms.
- ❌ Invisible focus states — focus rings must be visible for keyboard nav.

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from one consistent set (Phosphor/Heroicons), consistent stroke width
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover/focus states with smooth transitions (150–300ms)
- [ ] Text contrast ≥4.5:1 (body), ≥3:1 (large text/UI); verified against the table above
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px; sidebar collapses to a drawer/bottom nav below 768px
- [ ] No content hidden behind fixed headers/toolbars
- [ ] No horizontal scroll on mobile (data tables scroll horizontally *within their own container* only)
- [ ] Pricing/quantity columns use tabular numerals and right-alignment
- [ ] Status badges pair color with text/icon, not color alone
- [ ] Proposal document renders cleanly in `@media print` / PDF export, independent of app chrome
- [ ] Multi-step proposal builder autosaves and allows back navigation without data loss
