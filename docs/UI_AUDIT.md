# EventFlow UI Audit (Phase 0)

Done 2026-09-30, before the UI overhaul. Line numbers refer to the single-file
`index.html` as it was at commit `c32d950`, before Phase 0.5 split it into `css/` and `js/`.

## Structure

- **Screens (11):** Dashboard, Event Pipeline, My Proposals, Proposal Builder,
  Proposal Document, Inventory, Availability, Clients & CRM, Contracts,
  Invoices & Payments, Venue Visualizer (6 stages + Crop Library and Sessions panels).
- **Overlays:** login gate (`#auth-overlay`), one shared modal (`#modal-overlay`), toast.
- **Screen switching:** `navigate(page)` toggles `.section.active` on `#section-<page>`,
  sets `#page-title` from the `pages` map, and highlights the sidebar item by matching
  the text of its `onclick` attribute (so those attributes must not change).
- **CSS:** one main stylesheet, three per-screen style blocks (My Proposals, Proposal
  Builder, Visualizer), print/proposal/invoice CSS built as JS strings, and 534 inline
  `style=""` attributes plus many more in JS-generated HTML.
- **Tokens:** brand colors, shadows, and radii exist as `:root` variables, but with legacy
  names (`--sage` is the green, `--champagne-dark` is the gold). No spacing or type tokens.

## Problems, by severity

1. **Unusable on phones.** The sidebar is fixed at 220px and `.main` has a 220px left margin
   at every width. The only breakpoint (1100px) never collapses it.
2. **Hardcoded values.** 271 hex colors, 31 distinct font sizes (many 8–13px), 108 distinct
   padding values, mostly inline.
3. **Fake numbers.** "Active Events: 24", "↑ 4 from last month", "↑ 12% vs last month",
   the Event Pipeline cards, and the seed Upcoming Events rows are static HTML, not Supabase data.
4. **Weak hierarchy.** Most text is 11–13px, nav section labels are 9px, the page title is 20px.
   There's no clear primary action per page.
5. **Missing states.** Only Visualizer generation has a spinner. Few lists have empty states;
   errors only appear as toasts.
6. **Accessibility.** Zero `aria-*` attributes, 42 clickable `<div>`s with no keyboard access,
   no `:focus-visible` styles, and Unicode glyphs (◉ ✦ ⬡) used as icons that screen readers announce.
7. **Tables.** The client and invoice tables have no mobile treatment. The CRM's two-column layout only
   collapses at 1100px.
