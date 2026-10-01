# EventFlow

**Live:** [dabarjel.github.io/EventFlow](https://dabarjel.github.io/EventFlow/) (staff login required)

EventFlow is the proposal and booking tool I built for DaVinci's Florist, a wedding and event floral
company serving DC, Maryland, and Virginia. It replaced the paid SaaS tool the business was using.

<!-- SCREENSHOT: dashboard -->

## The problem

A florist's sales process is built around the proposal. A couple asks for a quote, the team picks
arrangements and rentals, prices them by area of the event, and sends something that has to look as
polished as the flowers. A paid, general-purpose SaaS tool handled this before. EventFlow replaces it
with software built around this company's own catalog and workflow.

EventFlow puts the catalog, the proposal, the client, and the payments in one place, with a client-facing
document designed for a luxury florist rather than a spreadsheet.

## Features

- **Proposal builder:** pick from a 775-item catalog of florals and rentals, group line items by event area
  (ceremony, cocktail hour, reception), and add a day-of schedule. Totals, deposits, and payments update live.
  Drafts autosave.
- **Client-facing proposal:** an editorial proposal document with mood images, editable inline and exported to PDF.
- **Venue Visualizer:** upload a venue photo and describe the design. AI generates a mockup that you can annotate
  and turn into proposal line items. It can also analyze a photo of a past event, detect the items in it,
  and match them to the inventory.
- **Inventory:** searchable catalog with category filters, bulk editing, and photo replacement.
- **Clients & CRM:** client records linked to their proposals and payment history.
- **Pipeline, calendar, invoices, contracts:** event stages, monthly availability, invoice preview and
  print, and an editable contract template.
- **Staff login:** invite-only accounts. Every table is protected by row-level security.

<!-- SCREENSHOT: proposal builder -->
<!-- SCREENSHOT: client-facing proposal -->
<!-- SCREENSHOT: Venue Visualizer -->
<!-- SCREENSHOT: mobile -->

## Stack

- **Frontend:** plain HTML, CSS, and JavaScript. No framework and no build step. Hosted on GitHub Pages.
- **Backend:** [Supabase](https://supabase.com): Postgres with row-level security, Auth, and Storage for
  inventory and visualizer images.
- **AI:** Claude (Anthropic) for venue analysis and item detection, and OpenAI image generation for
  mockups. Both are called through a Supabase Edge Function, so no API keys ship to the browser.

## Repo layout

```
index.html          markup
css/                design tokens, layout, components, per-screen styles
js/                 one file per screen plus shared auth, routing, and utilities
data/               base inventory catalog
supabase/           database migrations and the AI proxy Edge Function
design-system/      brand and design system
docs/               plans and audits
```
