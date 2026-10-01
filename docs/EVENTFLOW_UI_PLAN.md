# EventFlow UI Overhaul Plan

## Context for the agent
EventFlow is a proposal builder web app for DaVinci's Florist, a DC/MD/VA wedding and event floral company. It replaced a paid SaaS tool. It's a static HTML/CSS/JS app on GitHub Pages, backed by Supabase (auth, inventory, CRM, proposals, payments, Venue Visualizer).

Goal: make the UI look and feel like a modern, real product. I'm demoing it at a career fair tomorrow, so it has to be stable, polished, and look good on a laptop and a phone.

Use the frontend-design skill for all visual and layout decisions. Use the UX skills (heuristics review, accessibility) where they fit.

## Ground rules
- Work on a new branch: `ui-overhaul`. Do NOT push to `main`. GitHub Pages deploys from main, and the live site has to keep working until I merge.
- UI only. Don't change Supabase tables, auth logic, RLS, grants, Edge Functions, or API keys.
- Don't rename or remove any element IDs, data attributes, or functions that JS or Supabase calls depend on. Restyle, don't rewire.
- Keep every existing feature working: login gate, inventory, CRM, proposal builder, payments, Venue Visualizer.
- Keep the shared escapeHtml() utility on every place user data gets rendered. No new innerHTML with unescaped data.
- Keep the current stack. No framework or build step without asking me.
- Commit at the end of each phase with a clear message. Stop after each phase and show me what changed before moving on.

## Brand
Keep the existing brand from design-system/eventflow/MASTER.md: deep botanical green, brass gold, ivory, Playfair Display for headings, Inter for body. Modernize how it's used, don't replace it. No gradients.

## Phase 0: Audit (keep it quick)
1. Read the repo. List every screen/panel, where the CSS lives, and how screens are switched.
2. List the biggest UI problems: hardcoded colors and sizes, inconsistent spacing, cramped tables, weak hierarchy, missing loading/empty/error states, broken mobile layouts.
3. Give me a short summary and wait.

**Status: done.** Findings are in `docs/UI_AUDIT.md`.

## Phase 0.5: Organize the repo (no visual or behavior changes)
Commit after each step, then stop so I can test.

a. Split index.html. CSS goes into `css/`: base.css, layout.css, components.css, plus one file per screen that had its own style block. JS goes into `js/`: Supabase client, auth, router, shared utils (including escapeHtml), then one file per screen. Use plain `<script src>` tags in the order the code runs now, never `type="module"`, because inline onclick handlers need globals. Leave the print/proposal/invoice CSS strings where they are.
b. Clean up the root. Move eventflow_items.json and inventory.js into `data/`. Remove eventflow_v19.backup from the repo. Put the plan, audit, and review files in `docs/`. Restore CNAME with eventflow.davinciflorist.com.
c. Images: if Supabase stores image paths, leave `media floral/` and `media rentals/` alone. Otherwise rename them to `assets/media/floral` and `assets/media/rentals`, update every path, and check each source_file against a real file with exact case.
d. Create CLAUDE.md with the project rules.
e. Write a README.md for recruiters, with screenshot placeholders.

**Status: done, except for the CNAME, which is on hold.**
- a. Done. Kick-off calls (`_authInit`, `renderCalendar`, `renderDashboard`, `_pipelineRefreshCounts`) and the document listeners now live in `js/main.js`, which loads last. The invite/recovery URL hash is captured in `js/supabase-client.js` before `createClient()`.
- b. Done, with two exceptions. The backup was never in the repo: it's gitignored and was never committed, so it's not public. The local copy was left in place. The CNAME was not restored because `eventflow.davinciflorist.com` has no DNS record yet, and merging a CNAME would redirect the live site to a dead domain.
- c. No change. Supabase stores image paths (`proposals.items[].imgSrc`), so the media folders stay put. All 775 catalog image references match real files with exact case.

## Phase 1: Pick a direction
1. Create `styleguide.html` with 2 visual directions, both using the brand above. Show for each: color usage, type scale, buttons, inputs, a table row, an inventory card, a proposal summary card, and the nav.
2. Stop so I can pick one.

## Phase 2: Design tokens
1. Create `css/tokens.css` as the single source of truth: colors, type scale, spacing, radii, shadows, motion.
2. Replace hardcoded values across the app with tokens.
3. Update MASTER.md to match.

## Phase 3: Screens
Redesign in this order (most visible at the fair first):
1. Login screen
2. Navigation and app shell (sidebar on desktop, bottom or collapsible nav on mobile)
3. Dashboard / event pipeline
4. Proposal builder
5. Inventory catalog (image cards with a clean fallback when an image is missing)
6. CRM / clients
7. Payments and Venue Visualizer (light touch, consistency only)

Add loading, empty, and error states wherever they're missing. Commit after each screen.

Replace the fake dashboard and pipeline numbers (Active Events, revenue trend, "from last month" deltas, the static pipeline cards and seed upcoming events) with real Supabase data. Where a query would be complex, show an honest empty state instead.

## Phase 4: Polish and check
1. Run a UX heuristics review and an accessibility pass (contrast, focus styles, aria labels, keyboard nav). Fix high-severity items only.
2. Check every screen at 375px, 768px, and 1440px wide.
3. Click through every feature and confirm nothing broke. List anything you couldn't verify.
4. Run Lighthouse and report the scores.

## Phase 5: Demo prep
1. Make sure the app looks good with realistic sample data loaded.
2. Push the `ui-overhaul` branch and open a pull request. Don't merge it. I'll review and merge myself.
