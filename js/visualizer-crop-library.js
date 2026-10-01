// Venue Visualizer: Crop Library.

// ══════════════════════════════════════════════════════════════════════════════
// ── FEATURE 1: CROP LIBRARY ───────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Shared upload helper for every Venue Visualizer image (venue photo,
// current mockup, session/item thumbnails, crop library entries) — same
// shape as Phase 1's setInventoryImage: unique timestamped path per upload,
// returns the public URL on success, null on failure (toast already shown).
// `silent` suppresses the per-image toast for callers that upload several
// images in one action and want to show one aggregated summary instead of
// a stack of toasts that just overwrite each other (this app shows one
// toast at a time) — see vzaSessionDoSave.
async function _vizUploadImage(dataUrl, prefix, silent) {
  if (!sb) { if (!silent) showToast('Not connected to Supabase', 'toast-error'); return null; }
  if (!dataUrl) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type === 'image/png' ? 'png' : (blob.type === 'image/webp' ? 'webp' : 'jpg');
    const path = (prefix || 'viz') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
    const { error: upErr } = await sb.storage.from('viz-images').upload(path, blob, { contentType: blob.type });
    if (upErr) { if (!silent) showToast('Could not upload image: ' + upErr.message, 'toast-error'); return null; }
    const { data: { publicUrl } } = sb.storage.from('viz-images').getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    if (!silent) showToast('Could not process/upload an image', 'toast-error');
    return null;
  }
}

// Several places in the (unmigrated) Venue Visualizer code require a literal
// "data:mime;base64,..." string, not just an image URL — vizIdentifyItems
// and vzaAnalyzePhoto both regex-parse vizState.currentImageSrc /
// vzaState.imgSrc directly to get raw base64 for a Claude vision call.
// Restoring a session from Storage must reconstruct that exact shape rather
// than handing back a plain https:// URL, or those two features would
// break silently on any restored session.
async function _urlToDataUrl(url) {
  if (!url) return null;
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function vzaLibGet() {
  if (!sb) return {};
  const { data, error } = await sb.from('crop_library').select('*');
  if (error) { showToast('Could not load crop library: ' + error.message, 'toast-error'); return {}; }
  const map = {};
  (data || []).forEach(row => {
    map[row.key] = { key: row.key, name: row.name, category: row.category, imgSrc: row.image_url, savedAt: new Date(row.created_at).getTime() };
  });
  return map;
}

// Async, fetch-it-yourself version for a one-off caller — see
// _vzaLibCheckSync for the hot-loop version used by vzaRenderResults.
async function vzaLibCheck(item) {
  const lib = await vzaLibGet();
  return _vzaLibCheckSync(item, lib);
}

async function vzaLibSave(itemId) {
  const item = vzaState.items.find(i => i.id === itemId);
  if (!item) return;
  const thumbSrc = item.thumbSrc;
  if (!thumbSrc) { showToast('No crop image to save — confirm crops first', 'toast-info'); return; }
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }

  const nameEl  = document.getElementById('vza-name-'  + itemId);
  const catEl   = document.getElementById('vza-cat-'   + itemId);
  const name = (nameEl ? nameEl.value.trim() : '') || item.name;
  const cat  = (catEl  ? catEl.value         : item.category) || 'Other';
  const key  = item.invSku || ('VZA-' + name.toLowerCase().replace(/[^a-z0-9]/g,'-').slice(0,30) + '-' + Date.now());

  const publicUrl = await _vizUploadImage(thumbSrc, 'crop');
  if (!publicUrl) return; // upload error toast already shown

  const { error } = await sb.from('crop_library').upsert({ key, name, category: cat, image_url: publicUrl }, { onConflict: 'key' });
  if (error) { showToast('Could not save to crop library: ' + error.message, 'toast-error'); return; }

  // Mirror into the Inventory grid only when this crop is actually tied to a
  // real catalog/custom item (item.invSku) — unchanged reasoning from the
  // Phase 1 fix: an unmatched crop has no inventory row to attach a photo to.
  // Best-effort secondary side-effect, doesn't block the crop library save.
  if (item.invSku) {
    setInventoryImage(item.invSku, thumbSrc).then(inventoryUrl => {
      if (inventoryUrl) _vzaUpdateInvCardImg(item.invSku, inventoryUrl, name);
    });
  }

  // Update button
  const btn = document.getElementById('vza-lib-btn-' + itemId);
  if (btn) { btn.textContent = '✓ In Crop Library'; btn.classList.add('vza-lib-saved'); }

  showToast('✓ Saved to Crop Library: ' + name, 'toast-success');
}

// Update matching inventory card image in the DOM
function _vzaUpdateInvCardImg(sku, dataUrl, name) {
  const cards = document.querySelectorAll('#inv-grid .inv-card');
  cards.forEach(card => {
    if (card.dataset.sku === sku || (card.dataset.name || '').toLowerCase() === (name || '').toLowerCase()) {
      const imgDiv = card.querySelector('.inv-img');
      if (imgDiv) {
        imgDiv.innerHTML = '';
        const img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        img.src = dataUrl;
        imgDiv.appendChild(img);
      }
    }
  });
}

function vzaLibOpen() {
  vzaLibRender();
  document.getElementById('viz-lib-overlay').classList.add('open');
}
function vzaLibClose() {
  document.getElementById('viz-lib-overlay').classList.remove('open');
}

async function vzaLibRender() {
  const body = document.getElementById('viz-lib-panel-body');
  if (!body) return;
  const lib = await vzaLibGet();
  const entries = Object.values(lib).sort((a, b) => b.savedAt - a.savedAt);
  if (!entries.length) {
    body.innerHTML = '<div class="viz-lib-empty">No crops saved yet.<br>Confirm crops on a photo analysis, then click<br>"Save to Crop Library" on any item card.</div>';
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'viz-lib-grid';
  entries.forEach(e => {
    const el = document.createElement('div');
    el.className = 'viz-lib-entry';
    el.innerHTML = `<img src="${e.imgSrc}" alt="${escapeHtml(e.name)}">
      <div class="viz-lib-entry-body">
        <div class="viz-lib-entry-name" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>
        <div class="viz-lib-entry-meta">${escapeHtml(e.category || '')}${e.savedAt ? ' · ' + new Date(e.savedAt).toLocaleDateString() : ''}</div>
        <button class="viz-lib-entry-del" onclick="vzaLibDelete('${escapeHtml(e.key)}')">Delete</button>
      </div>`;
    grid.appendChild(el);
  });
  body.innerHTML = '';
  body.appendChild(grid);
}

async function vzaLibDelete(key) {
  if (!confirm('Remove this crop from the library?')) return;
  if (!sb) return;
  const { error } = await sb.from('crop_library').delete().eq('key', key);
  if (error) {
    showToast('Could not remove this crop: ' + error.message, 'toast-error');
    vzaLibRender();
    return;
  }
  // Best-effort mirror cleanup — its failure shouldn't hide the fact that the
  // library entry itself (the source of truth for this UI) was removed. Only
  // clear the Inventory-side image when this crop was actually mirrored
  // there in the first place, i.e. key is a real invSku, not a generated
  // 'VZA-...' slug — same real-sku check as vzaLibSave's fix.
  if (!key.startsWith('VZA-')) {
    const table = key.startsWith('CUST-') ? 'inventory_custom_items' : 'inventory_overrides';
    sb.from(table).update({ image_url: null }).eq('sku', key).then(({ error }) => {
      if (error) showToast('Removed from library, but could not clear the Inventory photo: ' + error.message, 'toast-error');
    });
  }
  vzaLibRender();
  showToast('Removed from library', 'toast-info');
}
