// Supabase project config + shared client (`sb`).

// ── SUPABASE CONFIG ───────────────────────────────────────────────────────────
// Project URL + anon public key — NOT secrets, safe to commit. They're meant
// to be embedded client-side; every table they can reach is gated by Postgres
// row-level security policies, not by hiding this key. Get both from the
// Supabase Dashboard → Project Settings → API, after creating the project and
// running supabase/migrations/0001_init_auth.sql in the SQL Editor.
const SUPABASE_URL = 'https://abelnnebtlgiyzobmhtr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWxubmVidGxnaXl6b2JtaHRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3MzQ0NTQsImV4cCI6MjA5OTMxMDQ1NH0.N_qgDODwkcmLeWnKjR8eLin-av0pza5da4yanJbnR08';
// Captured before createClient(): supabase-js may strip the invite/recovery
// tokens from the URL before _authInit() (in main.js) runs.
const _authInitialHash = window.location.hash;
const sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
