// Inventory screen: filtering, item detail, edit mode, custom items.

// Maps each chip's onclick key → all data-cat values it should match (old names + new names)
const CAT_ALIASES = {
  'Chairs & Barstools':     ['Chairs & Barstools', 'Seating'],
  'Lounge & Sofas':         ['Lounge & Sofas', 'Lounge Furniture'],
  'Tables & Coffee Tables': ['Tables & Coffee Tables', 'Tables'],
  'Bars':                   ['Bars', 'Bars & Displays'],
  'Charger Plates':         ['Charger Plates', 'Tableware'],
  'Vases & Candelabras':    ['Vases & Candelabras'],
  'Decor & Ceremony':       ['Decor & Ceremony', 'Décor & Props'],
  'Staging & Draping':      ['Staging & Draping', 'Flooring & Staging', 'Tents & Structures'],
  'Dance Floor':            ['Dance Floor'],
  'Photo Booth':            ['Photo Booth'],
  'Specialty':              ['Specialty', 'Lighting', 'Other'],
  'Linens & Swatches':      ['Linens & Swatches', 'Linens & Draping'],
  'Floral Arrangements':    ['Floral Arrangements'],
};
function catMatches(chipCat, itemCat) {
  const aliases = CAT_ALIASES[chipCat];
  return aliases ? aliases.includes(itemCat) : chipCat === itemCat;
}
let _activeCatKey = 'All';

const INV_FILTER_KEY = 'invFilter_v1';

function filterCat(el, cat) {
  el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  _activeCatKey = cat;
  filterInventory((document.getElementById('inv-search') || {value:''}).value);
}
function filterInventory(val) {
  const v = (val || '').toLowerCase();
  try { localStorage.setItem(INV_FILTER_KEY, JSON.stringify({ cat: _activeCatKey, search: v })); } catch(e) {}
  const cards = document.querySelectorAll('#inv-grid .inv-card');
  let visible = 0;
  cards.forEach(c => {
    const catMatch  = _activeCatKey === 'All' || catMatches(_activeCatKey, c.dataset.cat);
    const nameMatch = !v || (c.dataset.name || '').toLowerCase().includes(v)
                          || (c.dataset.sku  || '').toLowerCase().includes(v)
                          || (c.dataset.cat  || '').toLowerCase().includes(v);
    const show = catMatch && nameMatch;
    c.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  let emptyEl = document.getElementById('inv-empty-state');
  if (!visible) {
    if (!emptyEl) {
      emptyEl = document.createElement('div');
      emptyEl.id = 'inv-empty-state';
      emptyEl.style.cssText = 'grid-column:1/-1;text-align:center;padding:48px 20px;color:var(--stone);';
      emptyEl.innerHTML = '<div style="font-size:24px;margin-bottom:10px;opacity:.35;">◫</div><div style="font-weight:600;color:var(--charcoal);margin-bottom:6px;">No items match that search</div><div style="font-size:12.5px;margin-bottom:14px;">Try a different keyword or select a different category.</div>';
      document.getElementById('inv-grid').appendChild(emptyEl);
    }
    emptyEl.style.display = '';
  } else if (emptyEl) {
    emptyEl.style.display = 'none';
  }
}

function _invRestoreFilter() {
  try {
    const saved = JSON.parse(localStorage.getItem(INV_FILTER_KEY) || 'null');
    if (!saved) return;
    _activeCatKey = saved.cat || 'All';
    const searchEl = document.getElementById('inv-search');
    if (searchEl && saved.search) searchEl.value = saved.search;
    // Activate the right chip
    document.querySelectorAll('#section-inventory .filter-chip').forEach(c => {
      const oc = c.getAttribute('onclick') || '';
      const active = oc.includes("'" + _activeCatKey + "'") || oc.includes('"' + _activeCatKey + '"') || (_activeCatKey === 'All' && (oc.includes("'All'") || oc.includes('"All"')));
      c.classList.toggle('active', active);
    });
    // Apply filter to cards (reuse filterInventory so empty-state fires)
    filterInventory(saved.search || '');
  } catch(e) {}
}
// ── Dynamic Inventory Item Modal ──────────────────────────────────────────────
function openItemDetail(card) {
  if (document.getElementById('inv-grid').classList.contains('inv-edit-mode')) {
    openInvCardEdit(card); return;
  }
  const _esc = escapeHtml;
  const name  = card.dataset.name  || 'Rental Item';
  const price = card.dataset.price || 'MP';
  const sku   = card.dataset.sku   || '';
  const cat   = card.dataset.cat   || '';
  const imgEl = card.querySelector('.inv-img img');
  // Use getAttribute to preserve the relative path; imgEl.src returns an absolute URL
  const imgSrc = imgEl ? imgEl.getAttribute('src') : null;
  const priceDisplay = price === 'MP'
    ? '<span style="color:var(--blush-mid);">Market Price — call (301) 588-8900</span>'
    : '<span style="font-weight:600;">' + _esc(price) + ' / unit</span>';
  const imgHtml = imgSrc
    ? '<img src="' + _esc(imgSrc) + '" style="width:100%;height:200px;object-fit:cover;border-radius:var(--radius-sm);margin-bottom:14px;">'
    : '<div style="width:100%;height:120px;background:var(--champagne);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:48px;margin-bottom:14px;">📦</div>';
  const desc    = card.dataset.desc    || '';
  const section = card.dataset.section || '';
  const descHtml    = desc    ? '<div style="font-size:12.5px;color:var(--stone);line-height:1.6;margin-bottom:14px;padding:10px 12px;background:var(--cream);border-radius:var(--radius-sm);">' + _esc(desc) + '</div>' : '';
  const sectionHtml = section ? '<div class="detail-row"><span class="detail-label">Type</span><span>' + _esc(section) + '</span></div>' : '';
  // Store SKU on the modal element — avoids embedding JSON inside onclick attributes
  const modalContent = document.getElementById('modal-content');
  modalContent.dataset.detailSku = sku;
  modalContent.innerHTML =
    '<div class="modal-title">' + _esc(name) + '</div>' +
    imgHtml + descHtml + sectionHtml +
    (sku ? '<div class="detail-row"><span class="detail-label">SKU</span><span>' + _esc(sku) + '</span></div>' : '') +
    '<div class="detail-row"><span class="detail-label">Price</span><span>' + priceDisplay + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Availability</span><span style="color:#2F7D5A;font-weight:600;">✓ Available</span></div>' +
    '<div class="modal-actions">' +
      '<button class="btn" onclick="closeModal()">Close</button>' +
      '<button class="btn btn-primary" onclick="addInvItemToProposal()">Add to Proposal →</button>' +
    '</div>';
  document.getElementById('modal-overlay').classList.add('open');
}

// Safely adds the previewed inventory item to the active proposal.
// Reads card data via SKU lookup to avoid JSON-in-onclick quoting bugs.
function addInvItemToProposal() {
  const modal = document.getElementById('modal-content');
  const sku   = modal ? modal.dataset.detailSku : '';
  const card  = sku ? document.querySelector('#inv-grid .inv-card[data-sku="' + sku + '"]') : null;
  if (!card) { showToast('Item not found — try again', 'toast-error'); return; }
  const imgEl = card.querySelector('.inv-img img');
  propAddItem({
    name:   card.dataset.name   || 'Item',
    cat:    card.dataset.cat    || '',
    price:  card.dataset.price  || '',
    imgSrc: imgEl ? imgEl.getAttribute('src') : '',
    sku:    card.dataset.sku    || ''
  });
  closeModal();
  navigate('proposals');
  showToast('✓ Added to proposal — ' + (card.dataset.name || 'Item'), 'toast-success');
}

// ── INVENTORY EDITING SYSTEM ─────────────────────────────────────────────────
// Edits are stored in localStorage as { sku: {name, price} }
// On page load we apply overrides to the DOM so everything stays in sync.

// Reads every row of inventory_overrides as a {sku: {sku,name,price,cat,image_url}}
// map (renaming the table's `category` column to `cat` here, once, so every
// other place in this file that already deals in item.cat — proposal line
// items, the proposal-builder catalog grid, etc. — doesn't need to know the
// column is named differently in Postgres).
async function getInvEdits() {
  if (!sb) return {};
  const { data, error } = await sb.from('inventory_overrides').select('*');
  if (error) { showToast('Could not load inventory edits: ' + error.message, 'toast-error'); return {}; }
  const map = {};
  (data || []).forEach(row => { map[row.sku] = { sku: row.sku, name: row.name, price: row.price, cat: row.category, image_url: row.image_url }; });
  return map;
}

// Upserts one sku's override fields. Replaces the old getInvEdits-mutate-
// saveInvEdits(wholeMap) round trip — with a real table each sku is its own
// row, so there's no whole-map rewrite to do; only saveInvCardEdit calls this.
async function saveInvOverride(sku, fields) {
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return false; }
  const row = { sku };
  if (fields.name !== undefined)  row.name = fields.name;
  if (fields.price !== undefined) row.price = fields.price;
  if (fields.cat !== undefined)   row.category = fields.cat;
  const { error } = await sb.from('inventory_overrides').upsert(row, { onConflict: 'sku' });
  if (error) { showToast('Could not save this edit: ' + error.message, 'toast-error'); return false; }
  return true;
}

// Apply saved edits to all inv-card elements in the DOM
async function applyInvEdits() {
  await _authReady; // don't query before we know whether/who is signed in — see _authReady's comment
  const edits = await getInvEdits();
  document.querySelectorAll('#inv-grid .inv-card').forEach(card => {
    const sku = card.dataset.sku;
    if (!sku || !edits[sku]) return;
    const e = edits[sku];
    if (e.name) {
      card.dataset.name = e.name;
      const nameEl = card.querySelector('.inv-name');
      if (nameEl) nameEl.textContent = e.name;
    }
    if (e.price !== undefined && e.price !== null) {
      card.dataset.price = e.price;
      const priceEl = card.querySelector('.inv-price');
      if (priceEl) priceEl.textContent = e.price === 'MP' ? 'MP' : e.price + '/ea';
    }
    if (e.cat) {
      card.dataset.cat = e.cat;
      const metaEl = card.querySelector('.inv-meta');
      if (metaEl) metaEl.textContent = e.cat;
    }
    if (e.image_url) {
      const imgDiv = card.querySelector('.inv-img');
      if (imgDiv) {
        imgDiv.innerHTML = '';
        const img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        img.src = e.image_url;
        imgDiv.appendChild(img);
      }
    }
    card.dataset.edited = '1';
  });
  // Load user-added custom items, then update dashboard count
  if (typeof applyCustomInvItems === 'function') await applyCustomInvItems();
  const total = document.querySelectorAll('#inv-grid .inv-card').length;
  const statEl = document.getElementById('stat-inventory');
  const subEl  = document.getElementById('stat-inventory-sub');
  if (statEl) statEl.textContent = total;
  if (subEl)  subEl.textContent  = total + ' rentals & floral items · Da Vinci\'s catalog';
}

// Inject edit overlay markup into every inv-card (done once)
const INV_CATEGORIES = [
  'Bars','Bars & Displays','Chairs & Barstools','Charger Plates',
  'Dance Floor','Decor & Ceremony','Décor & Props','Floral Arrangements',
  'Flooring & Staging','Lighting','Linens & Draping','Linens & Swatches',
  'Lounge & Sofas','Lounge Furniture','Other','Photo Booth',
  'Seating','Specialty','Staging & Draping','Tables','Tables & Coffee Tables',
  'Tents & Structures','Vases & Candelabras',
];

let invOverlaysInjected = false;
function injectInvOverlays() {
  if (invOverlaysInjected) return;
  document.querySelectorAll('#inv-grid .inv-card').forEach(card => {
    // EDITED badge
    const badge = document.createElement('div');
    badge.className = 'inv-edited-badge';
    badge.textContent = 'EDITED';
    card.appendChild(badge);

    // Pencil button — kept as visual affordance; card click also opens overlay
    const pencilBtn = document.createElement('button');
    pencilBtn.className = 'inv-edit-btn';
    pencilBtn.textContent = '✏';
    pencilBtn.title = 'Edit this item';
    pencilBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      openInvCardEdit(card);
    });
    card.appendChild(pencilBtn);

    const catOptions = INV_CATEGORIES.map(c =>
      `<option value="${c}">${c}</option>`
    ).join('');

    // Bulk-edit overlay
    const overlay = document.createElement('div');
    overlay.className = 'inv-edit-overlay';
    overlay.innerHTML =
      '<div class="inv-bulk-header">' +
        '<span class="inv-bulk-counter"></span>' +
        '<div class="inv-bulk-nav">' +
          '<button type="button" onclick="skipInvCard(this,-1)" title="Previous (Shift+Enter)">↑</button>' +
          '<button type="button" onclick="skipInvCard(this,1)"  title="Skip →">↓</button>' +
        '</div>' +
      '</div>' +
      '<input class="inv-edit-name"  type="text" placeholder="Item name…"   autocomplete="off">' +
      '<select class="inv-edit-cat">' + catOptions + '</select>' +
      '<input class="inv-edit-price" type="text" placeholder="Price or MP"   autocomplete="off">' +
      '<div class="inv-edit-actions">' +
        '<button class="inv-edit-save"       type="button" onclick="saveInvCardEdit(this)">Save ↵</button>' +
        '<button class="inv-edit-photo-btn"  type="button" onclick="changeInvPhoto(this)"  title="Change photo">📷</button>' +
        '<button class="inv-edit-cancel-btn" type="button" onclick="cancelInvEdit(this)"   title="Cancel (Esc)">✕</button>' +
      '</div>';

    // Enter = save & next;  Shift+Enter = previous;  Escape = cancel
    overlay.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation();
        if (e.shiftKey) skipInvCard(overlay.querySelector('.inv-bulk-nav button'), -1);
        else overlay.querySelector('.inv-edit-save').click();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        overlay.classList.remove('open');
      }
    });

    // Prevent card's onclick from firing when clicking inside the overlay
    overlay.addEventListener('click', e => e.stopPropagation());
    card.appendChild(overlay);
  });
  invOverlaysInjected = true;
}

// Persists first, updates the DOM and advances to the next card only once
// that's confirmed — the old localStorage version updated the DOM first
// (a write to localStorage essentially never fails). A network write fails
// far more often, so doing it in that order here risked exactly the "UI
// claims success, nothing was actually saved" class of bug this codebase's
// getX/saveX hardening pass elsewhere was built to prevent. Same sku is
// shared between custom items and base-catalog overrides, just in different
// tables — a custom item's row already exists (addInvItemFromModal's
// insert), a base item's override row may not exist yet, hence upsert for
// both rather than update.
async function saveInvCardEdit(btn) {
  const overlay = btn.closest('.inv-edit-overlay');
  const card    = overlay.closest('.inv-card');
  const sku     = card.dataset.sku;

  const newName  = overlay.querySelector('.inv-edit-name').value.trim();
  const newPrice = overlay.querySelector('.inv-edit-price').value.trim();
  const newCat   = overlay.querySelector('.inv-edit-cat').value;

  if (!newName) { overlay.querySelector('.inv-edit-name').focus(); return; }

  if (sku) {
    if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }
    const table = sku.startsWith('CUST-') ? 'inventory_custom_items' : 'inventory_overrides';
    const { error } = await sb.from(table).upsert({ sku, name: newName, price: newPrice, category: newCat }, { onConflict: 'sku' });
    if (error) { showToast('Could not save this edit: ' + error.message, 'toast-error'); return; } // overlay stays open, nothing in the DOM changes
  }

  // Update DOM now that the write is confirmed
  card.dataset.name  = newName;
  card.dataset.price = newPrice;
  card.dataset.cat   = newCat;
  card.dataset.edited = '1';
  const nameEl  = card.querySelector('.inv-name');
  const priceEl = card.querySelector('.inv-price');
  const metaEl  = card.querySelector('.inv-meta');
  if (nameEl)  nameEl.textContent  = newName;
  if (priceEl) priceEl.textContent = newPrice === 'MP' ? 'MP' : newPrice + '/ea';
  if (metaEl)  metaEl.textContent  = newCat;

  // Live-update proposal grid if already built
  propInvBuilt = false;
  if (sku) {
    document.querySelectorAll('#prop-inv-grid .prop-inv-card').forEach(pc => {
      if (pc.dataset.sku !== sku) return;
      pc.dataset.name = newName; pc.dataset.price = newPrice; pc.dataset.cat = newCat;
      const pn = pc.querySelector('.prop-inv-card-name');
      const pp = pc.querySelector('.prop-inv-card-price');
      if (pn) pn.textContent = newName;
      if (pp) pp.textContent = newPrice && newPrice !== 'MP' ? newPrice : 'Call';
      pc.title = newName + (newPrice && newPrice !== 'MP' ? ' — ' + newPrice : '');
    });
  }

  // Close and advance to the next visible card
  overlay.classList.remove('open');
  const allVisible = [...document.querySelectorAll('#inv-grid .inv-card')]
    .filter(c => c.style.display !== 'none');
  const next = allVisible[allVisible.indexOf(card) + 1];
  if (next) openInvCardEdit(next);
}

function cancelInvEdit(btn) {
  const overlay = btn.closest('.inv-edit-overlay');
  const card = overlay.closest('.inv-card');
  overlay.querySelector('.inv-edit-name').value  = card.dataset.name  || '';
  overlay.querySelector('.inv-edit-price').value = card.dataset.price || '';
  const catSel = overlay.querySelector('.inv-edit-cat');
  if (catSel) catSel.value = card.dataset.cat || '';
  overlay.classList.remove('open');
}

// Open the bulk-edit overlay for a specific card, refreshing all field values
function openInvCardEdit(card) {
  document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
  const ov = card.querySelector('.inv-edit-overlay');
  if (!ov) return;

  ov.querySelector('.inv-edit-name').value  = card.dataset.name  || '';
  ov.querySelector('.inv-edit-price').value = card.dataset.price || '';
  const catSel = ov.querySelector('.inv-edit-cat');
  if (catSel) {
    catSel.value = card.dataset.cat || '';
    // If category isn't in the list, prepend it so the select still shows it
    if (card.dataset.cat && catSel.value !== card.dataset.cat) {
      const opt = document.createElement('option');
      opt.value = card.dataset.cat; opt.textContent = card.dataset.cat;
      catSel.prepend(opt);
      catSel.value = card.dataset.cat;
    }
  }

  // Update position counter
  const allVisible = [...document.querySelectorAll('#inv-grid .inv-card')]
    .filter(c => c.style.display !== 'none');
  const pos = allVisible.indexOf(card) + 1;
  const counter = ov.querySelector('.inv-bulk-counter');
  if (counter) counter.textContent = pos + ' / ' + allVisible.length;

  ov.classList.add('open');
  const nameInput = ov.querySelector('.inv-edit-name');
  nameInput.focus();
  nameInput.select();
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Move to the adjacent visible card without saving (dir: 1 = forward, -1 = back)
function skipInvCard(btn, dir) {
  const card = btn.closest('.inv-card');
  const allVisible = [...document.querySelectorAll('#inv-grid .inv-card')]
    .filter(c => c.style.display !== 'none');
  const next = allVisible[allVisible.indexOf(card) + (dir || 1)];
  if (next) openInvCardEdit(next);
  else btn.closest('.inv-edit-overlay').classList.remove('open');
}

// Let staff reassign a card's image from a local file; uploads to Supabase Storage
function changeInvPhoto(btn) {
  const card = btn.closest('.inv-card');
  const sku  = card.dataset.sku;
  const fi   = document.createElement('input');
  fi.type    = 'file';
  fi.accept  = 'image/*';
  fi.addEventListener('change', function () {
    const file = fi.files[0];
    if (!file) return;
    resizeImageFile(file, 800, 0.8).then(dataUrl => {
      return setInventoryImage(sku, dataUrl).then(publicUrl => {
        if (!publicUrl) return; // upload/link error toast already shown
        const imgDiv = card.querySelector('.inv-img');
        imgDiv.textContent = '';
        const img = document.createElement('img');
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        img.src = publicUrl;
        imgDiv.appendChild(img);
      });
    }).catch(() => {
      if (typeof showToast === 'function') showToast('Could not process that image — try a different file', 'toast-error');
    });
  });
  fi.click();
}

function toggleInvEditMode(btn) {
  const grid = document.getElementById('inv-grid');
  const isActive = btn.classList.toggle('active');
  grid.classList.toggle('inv-edit-mode', isActive);
  if (isActive) {
    injectInvOverlays();
    btn.textContent = '✓ Done Editing';
    document.getElementById('inv-edit-hint').innerHTML =
      '<strong style="color:var(--sage-dark);">Bulk edit ON</strong> — click any card to edit · <kbd style="background:var(--champagne);padding:1px 5px;border-radius:3px;font-size:10px;">Enter</kbd> saves &amp; advances · <kbd style="background:var(--champagne);padding:1px 5px;border-radius:3px;font-size:10px;">Shift+Enter</kbd> goes back · <kbd style="background:var(--champagne);padding:1px 5px;border-radius:3px;font-size:10px;">Esc</kbd> cancels · ↑↓ skip without saving.';
  } else {
    // Close any open overlays
    document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
    btn.textContent = '✏️ Edit Items';
    document.getElementById('inv-edit-hint').innerHTML =
      'Click <strong>✏️ Edit Items</strong> to fix names, categories, or prices — changes save automatically.';
  }
}

async function resetAllInvEdits() {
  if (!confirm('Reset ALL inventory edits back to original names and prices?')) return;
  if (sb) {
    const { error } = await sb.from('inventory_overrides').delete().neq('sku', ''); // PostgREST requires an explicit filter; sku is never '' so this matches every row
    if (error) { showToast('Could not reset edits: ' + error.message, 'toast-error'); return; }
  }
  // Restore DOM from original data attributes — reload is simplest
  location.reload();
}

// ── ADD INVENTORY ITEM (from modal) ──────────────────────────────────────────
// category → cat rename here too, same reasoning as getInvEdits.
async function getCustomInvItems() {
  if (!sb) return [];
  const { data, error } = await sb.from('inventory_custom_items').select('*').order('created_at', { ascending: false });
  if (error) { showToast('Could not load custom items: ' + error.message, 'toast-error'); return []; }
  return (data || []).map(row => ({ sku: row.sku, name: row.name, price: row.price, cat: row.category, notes: row.notes, image_url: row.image_url }));
}

async function addInvItemFromModal() {
  const nameEl  = document.getElementById('new-item-name');
  const catEl   = document.getElementById('new-item-cat');
  const priceEl = document.getElementById('new-item-price');
  const notesEl = document.getElementById('new-item-notes');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    if (nameEl) { nameEl.focus(); nameEl.style.borderColor = 'var(--blush-mid)'; setTimeout(() => nameEl.style.borderColor = '', 1800); }
    return;
  }
  const rawPrice = priceEl ? parseFloat(priceEl.value) : NaN;
  const price = (!isNaN(rawPrice) && rawPrice > 0) ? '$' + rawPrice.toFixed(2) : 'MP';
  const item = {
    name,
    cat:   catEl   ? catEl.value   : 'Other',
    price,
    notes: notesEl ? notesEl.value.trim() : '',
    sku:   'CUST-' + Date.now()
  };
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }
  const { error } = await sb.from('inventory_custom_items').insert({ sku: item.sku, name: item.name, category: item.cat, price: item.price, notes: item.notes });
  if (error) { showToast('Could not add item: ' + error.message, 'toast-error'); return; } // was a single push+full-array-save before — now a single-row insert, no whole-table rewrite

  if (_newItemImgBase64) {
    const publicUrl = await setInventoryImage(item.sku, _newItemImgBase64);
    _renderCustomInvCard(Object.assign({}, item, { image_url: publicUrl || null }));
    _newItemImgBase64 = null;
  } else {
    _renderCustomInvCard(item);
  }
  closeModal();
  // Flash feedback
  const grid = document.getElementById('inv-grid');
  if (grid) {
    const last = grid.lastElementChild;
    if (last) { last.style.outline = '2px solid var(--sage)'; setTimeout(() => last.style.outline = '', 1500); }
  }
}

function _renderCustomInvCard(item) {
  const grid = document.getElementById('inv-grid');
  if (!grid) return;
  const div = document.createElement('div');
  div.className = 'inv-card';
  div.setAttribute('data-name',  item.name);
  div.setAttribute('data-cat',   item.cat);
  div.setAttribute('data-price', item.price);
  div.setAttribute('data-sku',   item.sku);
  div.setAttribute('data-desc',  item.notes || '');
  div.setAttribute('onclick',    'openItemDetail(this)');
  const imgDiv = document.createElement('div');
  imgDiv.className = 'inv-img';
  if (item.image_url) {
    const imgEl = document.createElement('img');
    imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    imgEl.src = item.image_url;
    imgDiv.appendChild(imgEl);
  } else {
    imgDiv.textContent = '📦';
  }
  const body = document.createElement('div');
  body.className = 'inv-card-body';
  const _e = escapeHtml;
  body.innerHTML = '<div class="inv-name">' + _e(item.name) + '</div>'
    + '<div class="inv-meta">' + _e(item.cat) + '</div>'
    + '<div class="inv-footer"><span class="inv-avail">Available</span>'
    + '<span class="inv-price">' + _e(item.price === 'MP' ? 'MP' : item.price + '/ea') + '</span></div>';
  div.appendChild(imgDiv); div.appendChild(body);
  grid.appendChild(div);
  // Update inventory count stat
  const statEl = document.getElementById('stat-inventory');
  if (statEl) statEl.textContent = document.querySelectorAll('#inv-grid .inv-card').length;
  propInvBuilt = false; // force proposal browser refresh
}

async function applyCustomInvItems() {
  const items = await getCustomInvItems();
  items.forEach(item => _renderCustomInvCard(item));
}
