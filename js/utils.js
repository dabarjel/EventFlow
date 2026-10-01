// Shared helpers: escapeHtml, saved-proposal accessor, image resize/upload, toast, filter chips.

// ── HTML ESCAPING ─────────────────────────────────────────────────────────────
// Single shared escaper for every place user-typed data (client names, notes,
// custom item names, payment notes, CRM fields, session names, etc.) gets
// interpolated into an HTML string before innerHTML. Escapes quotes as well as
// angle brackets/ampersand — several call sites interpolate into attribute
// values (title="...", value="...") where a bare `"` is exploitable even if
// `<`/`>` are escaped, which earlier ad-hoc `_esc` helpers in this file missed.
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── SAVED PROPOSALS ACCESSOR ─────────────────────────────────────────────────
// Returns proposals shaped like the old localStorage records (key, clientName,
// fields, items, payments embedded) even though payments now live in their
// own table — the join happens once, here, so the many read-only callers
// throughout the app (dashboard, calendar, CRM table, My Proposals, the
// "load saved proposal" modal, Venue Visualizer's session-link dropdown)
// don't each need their own fetch-and-merge logic. Two flat queries + a
// client-side group-by is simple and plenty fast at this app's scale — no
// need for a real SQL join. The one place that deliberately bypasses this —
// propUpdateTotals()/propDocRender()'s payment ledger, re-rendered on nearly
// every keystroke — uses the _propCurrentPayments in-memory cache instead,
// so typing in the builder never fires a network request per keystroke.
async function getSavedProposals() {
  if (!sb) return [];
  const { data: proposals, error } = await sb.from('proposals').select('*').order('created_at', { ascending: false });
  if (error) { showToast('Could not load proposals: ' + error.message, 'toast-error'); return []; }
  const { data: payments, error: payErr } = await sb.from('proposal_payments').select('*');
  if (payErr) showToast('Could not load payment records: ' + payErr.message, 'toast-error');
  const paymentsByProposal = {};
  (payments || []).forEach(pay => {
    (paymentsByProposal[pay.proposal_id] = paymentsByProposal[pay.proposal_id] || []).push({
      id: pay.id,
      amount: pay.amount,
      note: pay.note,
      date: pay.paid_on ? new Date(pay.paid_on + 'T00:00:00').toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}) : '',
      isoDate: pay.paid_on || ''
    });
  });
  return (proposals || []).map(p => ({
    key: p.id,
    clientId: p.client_id,
    clientName: p.client_name,
    status: p.status,
    total: p.total,
    fields: p.fields || {},
    schedule: p.schedule || [],
    shipRate: p.ship_rate,
    taxRate: p.tax_rate,
    deposit: p.deposit,
    items: p.items || [],
    mockupImage: p.mockup_image_url,
    savedAt: new Date(p.updated_at).toLocaleString(),
    createdAt: new Date(p.created_at).getTime(),
    payments: paymentsByProposal[p.id] || []
  }));
}

// ── IMAGE RESIZE / COMPRESSION ───────────────────────────────────────────────
// Shared by every full-photo upload entry point (Venue Visualizer's venue-photo
// and analyze-photo uploads, Inventory's per-card photo replace in inventory.js)
// so a raw multi-MB camera photo never gets written to localStorage as-is —
// this was the single biggest source of quota exhaustion in the app. Downscales
// to maxDim on the longest side (never upscales a smaller image) and re-encodes
// as JPEG at the given quality, same approach already used correctly for crop
// thumbnails (vzaCropRegion) and session thumbnails (_vizMakeThumbnail).
function resizeImageFile(file, maxDim, quality) {
  maxDim = maxDim || 800;
  quality = quality || 0.8;
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth  || img.width  || maxDim;
      const h = img.naturalHeight || img.height || maxDim;
      const scale = Math.min(1, maxDim / Math.max(w, h)); // never upscale
      const outW = Math.max(1, Math.round(w * scale));
      const outH = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = outW; canvas.height = outH;
      canvas.getContext('2d').drawImage(img, 0, 0, outW, outH);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not load image')); };
    img.src = url;
  });
}

// ── INVENTORY IMAGES (Supabase Storage) ──────────────────────────────────────
// Uploads to the public 'inventory-images' bucket (one object per upload,
// timestamped so a photo replace can't collide with a stale CDN-cached URL
// for the old one) and links the resulting public URL onto the item's own
// row — inventory_custom_items for 'CUST-' skus, inventory_overrides for
// everything else. Returns the public URL on success, null on failure (a
// toast is already shown before returning null, matching every other saveX
// in this file — callers just check truthiness).
async function setInventoryImage(sku, dataUrl) {
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return null; }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type === 'image/png' ? 'png' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const path = sku + '-' + Date.now() + '.' + ext;
    const { error: upErr } = await sb.storage.from('inventory-images').upload(path, blob, { contentType: blob.type });
    if (upErr) { showToast('Could not upload photo: ' + upErr.message, 'toast-error'); return null; }
    const { data: { publicUrl } } = sb.storage.from('inventory-images').getPublicUrl(path);
    const table = sku.startsWith('CUST-') ? 'inventory_custom_items' : 'inventory_overrides';
    const { error: dbErr } = await sb.from(table).upsert({ sku, image_url: publicUrl }, { onConflict: 'sku' });
    if (dbErr) { showToast('Photo uploaded but could not link it to the item: ' + dbErr.message, 'toast-error'); return null; }
    return publicUrl;
  } catch (e) {
    showToast('Could not process/upload that image', 'toast-error');
    return null;
  }
}
function filterChip(el) {
  el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}
