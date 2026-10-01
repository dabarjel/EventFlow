// Login gate: session check, sign in/out, invite + password-reset flow.

// ── AUTH GATE ─────────────────────────────────────────────────────────────────
// Phase 0 of the Supabase migration: this only gates *visual/functional access*
// to the app behind a login screen. No feature's data reads/writes are backed
// by Supabase yet (that starts in phase 1, inventory overrides) — everything
// below the overlay still runs on localStorage exactly as before. The overlay
// is visible by default in the HTML so there's never a flash of real app
// content before a session is confirmed.
async function _authInit() {
  const statusEl = document.getElementById('auth-status');
  const formEl   = document.getElementById('auth-form');
  if (!sb) {
    if (statusEl) statusEl.textContent = 'Supabase isn\'t configured yet — set SUPABASE_URL / SUPABASE_ANON_KEY near the top of index.html.';
    _authResolveReady(); // unblock any awaiters — getInvEdits() etc. already degrade to empty when sb is null
    return;
  }

  // Invite and "reset password" emails redirect back here as
  // #access_token=...&refresh_token=...&type=invite (or type=recovery).
  // supabase-js's detectSessionInUrl (on by default) turns that into a real
  // session by the time getSession() below resolves — but an invited user
  // has no password yet, so a session existing is NOT enough to treat them
  // as signed in. Capture the link's type from the hash before it's gone
  // (Supabase doesn't reliably strip it itself) so we can route to a
  // "set your password" prompt instead of dropping them straight into the app.
  const hashParams = new URLSearchParams(_authInitialHash.replace(/^#/, ''));
  const linkType = hashParams.get('type'); // 'invite' | 'recovery' | null

  const { data: { session } } = await sb.auth.getSession();

  if (session && (linkType === 'invite' || linkType === 'recovery')) {
    history.replaceState(null, '', window.location.pathname + window.location.search); // drop the token out of the URL bar/history
    _authShowSetPassword(linkType);
  } else if (session) {
    _authOnSignedIn(session);
  } else {
    if (statusEl) statusEl.textContent = 'Sign in to continue';
    if (formEl) formEl.style.display = '';
    const emailEl = document.getElementById('auth-email');
    if (emailEl) emailEl.focus();
  }

  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { _authShowSetPassword(linkType || 'recovery'); return; }
    if (event === 'SIGNED_IN' && session) _authOnSignedIn(session);
    if (event === 'SIGNED_OUT') location.reload();
  });
}

async function _authSignIn() {
  const email    = (document.getElementById('auth-email')    || {value:''}).value.trim();
  const password = (document.getElementById('auth-password') || {value:''}).value;
  const errEl = document.getElementById('auth-error');
  if (errEl) errEl.textContent = '';
  if (!email || !password) { if (errEl) errEl.textContent = 'Enter your email and password.'; return; }
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) { if (errEl) errEl.textContent = error.message; return; }
  // onAuthStateChange fires SIGNED_IN and takes it from here.
}

// Shown for both a fresh invite (no password set yet) and a password-reset
// link — same UI, same call (auth.updateUser), only the status copy differs.
function _authShowSetPassword(kind) {
  const statusEl  = document.getElementById('auth-status');
  const formEl    = document.getElementById('auth-form');
  const setPassEl = document.getElementById('auth-setpass-form');
  if (statusEl) statusEl.textContent = kind === 'invite'
    ? 'Welcome to EventFlow — set a password to finish setting up your account.'
    : 'Set a new password to continue.';
  if (formEl) formEl.style.display = 'none';
  if (setPassEl) setPassEl.style.display = '';
  const pwEl = document.getElementById('auth-newpass');
  if (pwEl) pwEl.focus();
}

async function _authSetPassword() {
  const pw1 = (document.getElementById('auth-newpass')  || {value:''}).value;
  const pw2 = (document.getElementById('auth-newpass2') || {value:''}).value;
  const errEl = document.getElementById('auth-setpass-error');
  if (errEl) errEl.textContent = '';
  if (!pw1 || pw1.length < 6) { if (errEl) errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (pw1 !== pw2) { if (errEl) errEl.textContent = 'Passwords don\'t match.'; return; }
  const { error } = await sb.auth.updateUser({ password: pw1 });
  if (error) { if (errEl) errEl.textContent = error.message; return; }
  const { data: { session } } = await sb.auth.getSession();
  _authOnSignedIn(session);
}

// Resolved once the auth state is known (signed in, or unconfigured — see
// both call sites below). Any Supabase-backed read/write that fires at
// page-init time (e.g. applyInvEdits, called synchronously from the bottom
// of inventory.js's IIFE) must await this first: _authInit() is async and
// does NOT block the rest of the top-level script, so without this a
// data-load could race ahead of sign-in and see zero rows purely because
// the RLS-gated query ran before a session existed — not because the data
// itself was ever missing.
let _authResolveReady;
const _authReady = new Promise(resolve => { _authResolveReady = resolve; });

function _authOnSignedIn(session) {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.style.display = 'none';
  _authRenderUser(session);
  _authResolveReady();
}

async function _authRenderUser(session) {
  const email = session.user.email || '';
  let displayName = email;
  try {
    // supabase-js resolves API-level errors (permission denied, RLS denial,
    // etc.) as { data: null, error } rather than throwing — a previous
    // version of this code destructured only `data` and silently fell back
    // to the email on ANY failure, including a genuine misconfiguration, with
    // no visible signal that profiles was never actually being read. Logging
    // here isn't optional polish — it's what would have caught the missing
    // GRANT on profiles for the authenticated role immediately instead of it
    // going unnoticed until an unrelated Inventory bug surfaced it.
    const { data, error } = await sb.from('profiles').select('display_name').eq('id', session.user.id).single();
    if (error) console.warn('Could not load profile display_name, falling back to email:', error.message);
    else if (data && data.display_name) displayName = data.display_name;
  } catch (e) { console.warn('Could not load profile display_name, falling back to email:', e); }
  const nameEl   = document.getElementById('auth-user-name');
  const emailEl  = document.getElementById('auth-user-email');
  const avatarEl = document.getElementById('auth-user-avatar');
  if (nameEl)   nameEl.textContent   = displayName;
  if (emailEl)  emailEl.textContent  = email;
  if (avatarEl) avatarEl.textContent = displayName.slice(0, 2).toUpperCase();
}

async function _authSignOut() {
  if (!sb || !confirm('Sign out of EventFlow?')) return;
  await sb.auth.signOut();
}
