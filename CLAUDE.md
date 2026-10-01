# EventFlow: project rules

Proposal builder for DaVinci's Florist. Static HTML/CSS/JS on GitHub Pages (deploys from `main`),
backed by Supabase (auth, inventory, CRM, proposals, payments, Venue Visualizer). No framework, no build step.

## Layout

- `index.html`: markup only. Links `css/*.css` and loads `js/*.js` as plain `<script src>` tags.
- `css/`: `base.css` (tokens + reset), `layout.css` (app shell), `components.css`, one file per screen.
  Load order is cascade order. Don't reorder the `<link>` tags.
- `js/`: one file per concern/screen, all classic scripts sharing globals. **No `type="module"`.**
  Inline `onclick` handlers need global functions.
  Top-level code that *runs* (not just declares) belongs in `js/main.js`, which loads last.
- `data/inventory.js`: base catalog (generated). `data/eventflow_items.json`: its source data.
- `media rentals/`, `media floral/`: catalog images. Saved proposals in Supabase store these paths
  (`proposals.items[].imgSrc`), so renaming the folders breaks existing proposals without a data migration.
- `supabase/`: migrations and the `ai-proxy` Edge Function. `docs/`: plans, audits, reviews.
- Design system: `design-system/eventflow/MASTER.md`. Check it before styling UI.

## Rules

- **Supabase grants:** any new table needs an explicit
  `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;` in addition to its RLS policies.
  Verify it in `information_schema.role_table_grants`. When querying, check `error`, not just `data`.
  A missing grant returns an error, not an empty result.
- **Escaping:** all user data goes through `escapeHtml()` (`js/utils.js`) before it is rendered into HTML.
  Never interpolate unescaped data into `innerHTML` or attribute values.
- **Don't rewire:** never rename or remove element IDs, data attributes, or functions that inline `onclick`
  handlers, `navigate()`, or Supabase calls depend on. `navigate()` highlights the sidebar by matching the text
  of each nav item's `onclick`.
- **No API keys in client code.** AI calls go through the Supabase Edge Function (`supabase/functions/ai-proxy`).
  The Supabase anon key is public by design, and RLS protects the data.
- **Paths:** relative paths only, with exact filename case. GitHub Pages runs on Linux and is case-sensitive.
- **Process:** make one change at a time. Verify before reporting something as done, and list anything you couldn't test.
