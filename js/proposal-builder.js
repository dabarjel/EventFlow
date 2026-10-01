// Proposal Builder screen: inventory picker, line items, totals, payments, draft autosave, schedule.

// ── PROPOSAL STATE ───────────────────────────────────────────────────────────
let proposalItems = [];   // [{id, name, category, price, imgSrc, qty}]
let propActiveCat = 'Chairs & Barstools';
let propInvBuilt = false;
let propItemIdCounter = 0;

// Payments now live in their own proposal_payments table instead of embedded
// on the proposal row, but propUpdateTotals()/propDocRender()'s ledger are
// re-rendered on nearly every keystroke — re-fetching from Supabase that
// often would mean a network round trip per keystroke. This in-memory cache
// holds the currently-open proposal's payments the same way proposalItems
// already holds its line items: populated once by propLoadProposal()/
// propNewBlank(), kept in sync by propLogPayment()/propDeletePayment().
let _propCurrentPayments = [];
// The currently-open saved proposal record (from getSavedProposals()), same
// lifecycle as _propCurrentPayments. renderProposalDoc() reads its mockupImage
// synchronously, so it can't await a fetch of its own.
let _savedProp = null;

// ── BUILD INVENTORY GRID ──────────────────────────────────────────────────────
// ── PROP INVENTORY DATA STORE ────────────────────────────────────────────────
let _propInvData = [];   // [{name,cat,price,sku,imgSrc}] — built once from #inv-grid

function propBuildInventory() {
  const grid = document.getElementById('prop-inv-grid');
  if (!grid) return;
  const invCards = document.querySelectorAll('#inv-grid .inv-card');
  if (!invCards.length) {
    grid.innerHTML = '<div style="padding:20px;color:var(--stone);text-align:center;">No inventory items found.</div>';
    return;
  }

  // Extract all item data into memory — read .src once while #inv-grid is in DOM
  _propInvData = [];
  invCards.forEach(card => {
    const imgEl  = card.querySelector('.inv-img img');
    const rawSrc = imgEl ? imgEl.getAttribute('src') : '';
    // Accept both data: URLs (user-uploaded) and relative file paths (media folders)
    const imgSrc = rawSrc || '';
    _propInvData.push({
      name:   card.dataset.name  || 'Item',
      cat:    card.dataset.cat   || '',
      price:  card.dataset.price || 'MP',
      sku:    card.dataset.sku   || '',
      imgSrc: imgSrc
    });
  });

  const _catEmoji = {
    'Chairs & Barstools':'🪑','Seating':'🪑',
    'Lounge & Sofas':'🛋️','Lounge Furniture':'🛋️',
    'Tables & Coffee Tables':'🪵','Tables':'🪵',
    'Bars':'🍸','Bars & Displays':'🍸',
    'Charger Plates':'🍽️','Tableware':'🍽️',
    'Vases & Candelabras':'🕯️',
    'Decor & Ceremony':'🌸','Décor & Props':'🌸',
    'Staging & Draping':'🎭','Flooring & Staging':'🎭','Tents & Structures':'⛺',
    'Linens & Swatches':'🧵','Linens & Draping':'🧵',
    'Floral Arrangements':'💐',
    'Specialty':'✨','Lighting':'💡','Other':'📦',
    'Photo Booth':'📸','Dance Floor':'💃',
  };

  grid.innerHTML = '';

  // IntersectionObserver: swap in real image only when card enters viewport
  const imgObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const div = entry.target;
      const src = div.dataset.imgSrc;
      if (src && !div.querySelector('img')) {
        const placeholder = div.querySelector('.prop-img-placeholder');
        if (placeholder) {
          const img = document.createElement('img');
          img.src = src;
          img.style.cssText = 'width:100%;height:100px;object-fit:cover;display:block;';
          placeholder.replaceWith(img);
        }
      }
      obs.unobserve(div);
    });
  }, { root: null, rootMargin: '400px 0px', threshold: 0 });

  _propInvData.forEach(item => {
    const { name, cat, price, sku, imgSrc } = item;
    const emoji = _catEmoji[cat] || '📦';

    const div = document.createElement('div');
    div.className = 'prop-inv-card';
    div.draggable = true;
    div.dataset.name   = name;
    div.dataset.cat    = cat;
    div.dataset.price  = price;
    div.dataset.sku    = sku;
    div.dataset.imgSrc = imgSrc;   // store for observer
    div.title = name + (price && price !== 'MP' ? ' — ' + price : '');

    // Render placeholder immediately — no grey flash, no lazy loading race
    const safeName = escapeHtml(name);
    div.innerHTML = '<div class="prop-img-placeholder" style="width:100%;height:100px;background:linear-gradient(135deg,var(--champagne) 0%,var(--sage-light) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;">'
      + '<span style="font-size:20px;">' + emoji + '</span>'
      + '<span style="font-size:9px;color:var(--stone);text-align:center;padding:0 6px;line-height:1.3;max-height:28px;overflow:hidden;">' + safeName + '</span>'
      + '</div>'
      + '<div class="prop-inv-card-body">'
      + '<div class="prop-inv-card-name">' + safeName + '</div>'
      + '<div class="prop-inv-card-price">' + escapeHtml(price && price !== 'MP' ? price : 'Call') + '</div>'
      + '</div>'
      + '<button class="prop-inv-card-add" type="button">+</button>';

    if (imgSrc) imgObserver.observe(div);   // swap in real image when scrolled to

    div.addEventListener('dragstart', e => {
      e.dataTransfer.setData('propItem', JSON.stringify({name, cat, price, imgSrc, sku}));
      e.dataTransfer.effectAllowed = 'copy';
    });

    function doAddItem() {
      propAddItem({name, cat, price, imgSrc, sku});
      div.style.transition = 'transform 0.12s, box-shadow 0.12s';
      div.style.transform = 'scale(0.94)';
      div.style.boxShadow = '0 0 0 2px var(--sage)';
      setTimeout(() => { div.style.transform = ''; div.style.boxShadow = ''; }, 200);
    }

    // + button
    div.querySelector('.prop-inv-card-add').addEventListener('click', e => {
      e.stopPropagation(); e.preventDefault();
      doAddItem();
    });
    // Click card body also adds
    div.querySelector('.prop-inv-card-body').addEventListener('click', doAddItem);

    grid.appendChild(div);
  });

  // Wire up drop zone on canvas box AFTER building inventory
  const canvasBox = document.getElementById('prop-canvas-box');
  if (canvasBox) {
    canvasBox.addEventListener('dragover', e => {
      e.preventDefault();
      canvasBox.classList.add('drop-highlight');
    });
    canvasBox.addEventListener('dragleave', e => {
      if (!canvasBox.contains(e.relatedTarget)) canvasBox.classList.remove('drop-highlight');
    });
    canvasBox.addEventListener('drop', e => {
      e.preventDefault();
      canvasBox.classList.remove('drop-highlight');
      const raw = e.dataTransfer.getData('propItem');
      if (!raw) return;
      try { propAddItem(JSON.parse(raw)); } catch(err) { console.error(err); }
    });
  }

  propInvBuilt = true;
  propUpdateChipCounts();
  // Default to Chairs on first load
  if (!propActiveCat || propActiveCat === 'All') propActiveCat = 'Chairs & Barstools';
  propFilter();
  _invRestoreFilter();
}

// ── CHIP COUNTS ──────────────────────────────────────────────────────────────
function propUpdateChipCounts() {
  // Count items per category from _propInvData
  const counts = {};
  _propInvData.forEach(item => { counts[item.cat] = (counts[item.cat] || 0) + 1; });
  document.querySelectorAll('#prop-chips .prop-cat-chip').forEach(chip => {
    const cat = chip.dataset.cat || chip.getAttribute('onclick').match(/'([^']+)'/)?.[1] || '';
    const n = counts[cat] || 0;
    // strip old count badge
    chip.textContent = chip.textContent.replace(/\s*\(\d+\)$/, '');
    if (n) chip.textContent += ' (' + n + ')';
  });
}

// ── PROPOSAL INV SIZE + PAGINATION ───────────────────────────────────────────
let propLargeCards = false;
let propCurrentPage = 1;
const PROP_PAGE_SIZE = 30; // items per page — large enough to work with, small enough to be fast

function propToggleSize() {
  propLargeCards = !propLargeCards;
  const grid = document.getElementById('prop-inv-grid');
  const btn  = document.getElementById('prop-size-toggle');
  if (grid) grid.classList.toggle('large-cards', propLargeCards);
  if (btn)  btn.textContent = propLargeCards ? '⊟' : '⊞';
}

function propChangePage(delta) {
  propCurrentPage = Math.max(1, propCurrentPage + delta);
  propFilter();
  const grid = document.getElementById('prop-inv-grid');
  if (grid) grid.scrollTop = 0;
}

// ── FILTER ────────────────────────────────────────────────────────────────────
function propFilter() {
  if (!propInvBuilt) return;
  const q = (document.getElementById('prop-search').value || '').toLowerCase().trim();
  const allCards = Array.from(document.querySelectorAll('#prop-inv-grid .prop-inv-card'));

  // First pass: determine which cards match
  const matching = allCards.filter(c => {
    const name    = (c.dataset.name || '').toLowerCase();
    const cat     = (c.dataset.cat  || '').toLowerCase();
    const sku     = (c.dataset.sku  || '').toLowerCase();
    const catMatch = propActiveCat === 'All' || catMatches(propActiveCat, c.dataset.cat);
    const nameMatch = !q || name.includes(q) || cat.includes(q) || sku.includes(q);
    return catMatch && nameMatch;
  });

  const totalMatching = matching.length;
  const totalPages = Math.max(1, Math.ceil(totalMatching / PROP_PAGE_SIZE));

  // Clamp page
  if (propCurrentPage > totalPages) propCurrentPage = totalPages;
  if (propCurrentPage < 1) propCurrentPage = 1;

  const startIdx = (propCurrentPage - 1) * PROP_PAGE_SIZE;
  const pageItems = matching.slice(startIdx, startIdx + PROP_PAGE_SIZE);
  const pageSet = new Set(pageItems);

  // Show/hide and highlight
  allCards.forEach(c => {
    const inMatch = matching.includes(c);
    const onPage  = pageSet.has(c);
    c.style.display = onPage ? '' : 'none';

    if (onPage && q) {
      const nameEl = c.querySelector('.prop-inv-card-name');
      if (nameEl) {
        const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + ')', 'gi');
        // Split on the match (capturing group interleaves unmatched/matched segments),
        // then escape each segment individually — escaping the whole string first and
        // matching against it risks the regex (built from raw, unescaped q) misaligning
        // with escaped output.
        nameEl.innerHTML = (c.dataset.name || '').split(re).map((part, i) =>
          i % 2 === 1
            ? '<mark style="background:#F5EEDD;border-radius:2px;padding:0 1px;">' + escapeHtml(part) + '</mark>'
            : escapeHtml(part)
        ).join('');
      }
    } else if (onPage) {
      const nameEl = c.querySelector('.prop-inv-card-name');
      if (nameEl) nameEl.textContent = c.dataset.name || '';
    }
  });

  // Update count label
  const lbl = document.getElementById('prop-count-label');
  if (lbl) lbl.textContent = totalMatching + (totalMatching === 1 ? ' item' : ' items');

  // Show/update pagination only when needed
  const paginationEl = document.getElementById('prop-pagination');
  const pageInfoEl   = document.getElementById('prop-page-info');
  const prevBtn      = document.getElementById('prop-prev-btn');
  const nextBtn      = document.getElementById('prop-next-btn');

  if (totalPages > 1) {
    if (paginationEl) paginationEl.style.display = 'flex';
    if (pageInfoEl)   pageInfoEl.textContent = `Page ${propCurrentPage} of ${totalPages} (${startIdx+1}–${Math.min(startIdx+PROP_PAGE_SIZE, totalMatching)} of ${totalMatching})`;
    if (prevBtn) prevBtn.disabled = propCurrentPage <= 1;
    if (nextBtn) nextBtn.disabled = propCurrentPage >= totalPages;
  } else {
    if (paginationEl) paginationEl.style.display = 'none';
  }
}

function propSetCat(cat, btn) {
  propActiveCat = cat;
  propCurrentPage = 1; // reset to first page on category change
  document.querySelectorAll('.prop-cat-chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // Show/hide custom upload bar
  const bar = document.getElementById('prop-custom-bar');
  const grid = document.getElementById('prop-inv-grid');
  if (cat === '__custom__') {
    if (bar) bar.style.display = '';
    if (grid) grid.style.display = 'none';
    const lbl = document.getElementById('prop-count-label');
    if (lbl) lbl.textContent = 'custom items';
  } else {
    if (bar) bar.style.display = 'none';
    if (grid) grid.style.display = '';
    propFilter();
  }
}

// ── CUSTOM ITEM IMAGE HANDLING ────────────────────────────────────────────────
let ciImgBase64 = null;
let _newItemImgBase64 = null;
function _newItemHandleImg(input) {
  const file = input.files[0];
  const nameEl = document.getElementById('new-item-img-name');
  if (!file) { _newItemImgBase64 = null; if (nameEl) nameEl.textContent = ''; return; }
  if (nameEl) nameEl.textContent = '📷 ' + file.name;
  resizeImageFile(file, 800, 0.8).then(dataUrl => {
    _newItemImgBase64 = dataUrl;
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not process that image — try a different file', 'toast-error');
  });
}

function ciHandleImg(input) {
  const file = input.files[0];
  if (!file) return;
  resizeImageFile(file, 800, 0.8).then(dataUrl => {
    ciImgBase64 = dataUrl; // full data URL, resized/compressed
    const preview = document.getElementById('ci-img-preview');
    const previewImg = document.getElementById('ci-img-preview-img');
    const icon = document.getElementById('ci-img-icon');
    const text = document.getElementById('ci-img-text');
    if (previewImg) previewImg.src = ciImgBase64;
    if (preview) preview.style.display = '';
    if (icon) icon.textContent = '✓';
    if (text) text.textContent = file.name;
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not process that image — try a different file', 'toast-error');
  });
}

function ciClearImg() {
  ciImgBase64 = null;
  const preview = document.getElementById('ci-img-preview');
  const input = document.getElementById('ci-img-input');
  const icon = document.getElementById('ci-img-icon');
  const text = document.getElementById('ci-img-text');
  if (preview) preview.style.display = 'none';
  if (input) input.value = '';
  if (icon) icon.textContent = '📷';
  if (text) text.textContent = 'Click to upload image (optional)';
}

function ciAddItem() {
  const name  = (document.getElementById('ci-name')  || {value:''}).value.trim();
  const price = (document.getElementById('ci-price') || {value:''}).value.trim();
  const cat   = (document.getElementById('ci-cat')   || {value:'Custom'}).value;
  const area  = (document.getElementById('ci-area')  || {value:''}).value.trim();
  const desc  = (document.getElementById('ci-desc')  || {value:''}).value.trim();

  if (!name) {
    const nameEl = document.getElementById('ci-name');
    if (nameEl) { nameEl.focus(); nameEl.style.borderColor = 'var(--blush-mid)'; setTimeout(() => nameEl.style.borderColor = '', 1500); }
    return;
  }

  // Normalise price to $XX.XX format
  const rawNum = parseFloat((price || '').replace(/[^0-9.]/g, ''));
  const normPrice = (!isNaN(rawNum) && rawNum >= 0) ? '$' + rawNum.toFixed(2) : price;

  propItemIdCounter++;
  proposalItems.push({
    id:      propItemIdCounter,
    name:    name,
    cat:     cat,
    price:   normPrice,
    imgSrc:  ciImgBase64 || '',
    sku:     'CUSTOM-' + propItemIdCounter,
    qty:     1,
    notes:   desc,
    area:    area,
    isCustom: true
  });

  propRender();
  propUpdateTotals();

  // Flash success feedback
  const btn = document.querySelector('[onclick="ciAddItem()"]');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'var(--sage-dark)';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1400);
  }

  // Reset form for next item (keep category + area for rapid multi-item entry)
  document.getElementById('ci-name').value  = '';
  document.getElementById('ci-price').value = '';
  document.getElementById('ci-desc').value  = '';
  ciClearImg();
  document.getElementById('ci-name').focus();
}

// ── ADD ITEMS — always adds a fresh line; same item = separate line, not merged ─
function propAddItem(item) {
  propItemIdCounter++;
  proposalItems.push({
    id: propItemIdCounter,
    name: item.name,
    cat: item.cat || item.category || '',
    price: item.price || '',
    imgSrc: item.imgSrc || '',
    sku: item.sku || '',
    qty: 1,
    notes: '',
    area: ''   // event area: Entrance, Adults Area, Teens Area, Cocktail, Reception, etc.
  });
  propRender();
}




// ── QTY + REMOVE — use stable item IDs not array indices ─────────────────────
function propChangeQty(itemId, delta) {
  const item = proposalItems.find(i => i.id === itemId);
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  // Re-render the single row in-place to avoid losing focus elsewhere
  const row = document.querySelector('.prop-item-row[data-id="' + itemId + '"]');
  if (row) {
    const newRow = buildItemRow(item);
    row.replaceWith(newRow);
  }
  propUpdateTotals();
}

function propRemove(itemId) {
  proposalItems = proposalItems.filter(i => i.id !== itemId);
  propRender();
}

function propClearAll() {
  if (proposalItems.length && !confirm('Clear all items from this proposal?')) return;
  proposalItems = [];
  propRender();
}

// ── RENDER CANVAS ─────────────────────────────────────────────────────────────
// ── AREA OPTIONS (shared) ────────────────────────────────────────────────────
const PROP_AREA_OPTIONS = ['Entrance','Ceremony','Cocktail Hour','Reception','Adults Area','Teens Area','Kids Area','Photo Booth Area','Dance Floor','Bar Area','Lounge Area','Head Table','Sweetheart Table','Other'];

// Ensure datalist exists in DOM
function ensureAreaDatalist() {
  if (!document.getElementById('prop-area-datalist')) {
    const dl = document.createElement('datalist');
    dl.id = 'prop-area-datalist';
    PROP_AREA_OPTIONS.forEach(o => { const op = document.createElement('option'); op.value = o; dl.appendChild(op); });
    document.body.appendChild(dl);
  }
}

// ── BUILD SINGLE ITEM ROW ─────────────────────────────────────────────────────
function buildItemRow(item) {
  const priceNum  = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
  const priceDisp = priceNum > 0 ? '$' + priceNum.toFixed(2) : (item.price || '');

  const row = document.createElement('div');
  row.className = 'prop-item-row';
  row.dataset.id = item.id;

  // ── MAIN: thumbnail on left, body on right ───────────────────────────────────
  const main = document.createElement('div');
  main.className = 'prop-item-row-main';

  // Thumbnail
  const thumb = item.imgSrc ? (() => {
    const i = document.createElement('img');
    i.className = 'prop-item-img'; i.src = item.imgSrc; return i;
  })() : (() => {
    const d = document.createElement('div');
    d.className = 'prop-item-img-placeholder'; d.textContent = item.isCustom ? '📎' : '📦'; return d;
  })();
  // Custom item badge overlay
  if (item.isCustom) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;';
    wrap.appendChild(thumb);
    const badge = document.createElement('div');
    badge.textContent = 'CUSTOM';
    badge.style.cssText = 'position:absolute;bottom:2px;left:2px;background:var(--champagne-dark);color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;letter-spacing:0.5px;pointer-events:none;';
    wrap.appendChild(badge);
    main.appendChild(wrap);
  } else if (item.isVenueItem) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;flex-shrink:0;';
    wrap.appendChild(thumb);
    const badge = document.createElement('div');
    badge.textContent = 'VENUE';
    badge.style.cssText = 'position:absolute;bottom:2px;left:2px;background:#2F7D5A;color:#fff;font-size:8px;font-weight:700;padding:1px 5px;border-radius:4px;letter-spacing:0.5px;pointer-events:none;';
    wrap.appendChild(badge);
    main.appendChild(wrap);
  } else {
    main.appendChild(thumb);
  }

  // Body: row A (category + controls + delete), row B (name), row C (description)
  const body = document.createElement('div');
  body.className = 'prop-item-body';

  // ── ROW A: area | qty | price | ✕ (no category tag — it's only for searching) ─
  const rowA = document.createElement('div');
  rowA.className = 'prop-item-row-a';

  // Area pill
  ensureAreaDatalist();
  const areaIn = document.createElement('input');
  areaIn.type = 'text';
  areaIn.className = 'prop-item-area-input';
  areaIn.setAttribute('list', 'prop-area-datalist');
  areaIn.value = item.area || '';
  areaIn.placeholder = '+ Area';
  areaIn.title = 'Event area — groups items in the printed proposal';
  areaIn.addEventListener('input',  () => { item.area = areaIn.value; });
  areaIn.addEventListener('change', () => { item.area = areaIn.value.trim(); propRenderGrouped(); });
  rowA.appendChild(areaIn);

  // Qty — typed input + +/- buttons for fast bulk entry
  const qtyWrap = document.createElement('div');
  qtyWrap.className = 'prop-qty-ctrl';
  qtyWrap.title = 'Type a quantity or use − + buttons';

  const decBtn = document.createElement('button');
  decBtn.className = 'prop-qty-btn'; decBtn.type = 'button';
  decBtn.dataset.action = 'dec'; decBtn.dataset.id = item.id; decBtn.textContent = '−';

  const qtyIn = document.createElement('input');
  qtyIn.type = 'number'; qtyIn.min = '1'; qtyIn.step = '1';
  qtyIn.className = 'prop-qty-input';
  qtyIn.value = item.qty;
  qtyIn.title = 'Type quantity directly — e.g. 100';
  qtyIn.addEventListener('input', () => {
    const v = parseInt(qtyIn.value) || 1;
    item.qty = Math.max(1, v);
    const pn = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
    totalSpan.textContent = pn > 0 && item.qty > 1
      ? 'x' + item.qty + ' = $' + (pn * item.qty).toLocaleString('en-US', {minimumFractionDigits:2})
      : '';
    propUpdateTotals();
  });
  qtyIn.addEventListener('blur', () => {
    const v = parseInt(qtyIn.value) || 1;
    item.qty = Math.max(1, v);
    qtyIn.value = item.qty;
    propUpdateTotals();
  });
  qtyIn.addEventListener('focus', () => qtyIn.select());
  qtyIn.addEventListener('keydown', e => { if (e.key === 'Enter') qtyIn.blur(); });

  const incBtn = document.createElement('button');
  incBtn.className = 'prop-qty-btn'; incBtn.type = 'button';
  incBtn.dataset.action = 'inc'; incBtn.dataset.id = item.id; incBtn.textContent = '+';

  qtyWrap.appendChild(decBtn);
  qtyWrap.appendChild(qtyIn);
  qtyWrap.appendChild(incBtn);
  rowA.appendChild(qtyWrap);

  // Price
  const priceWrap = document.createElement('div');
  priceWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0;';
  const priceIn = document.createElement('input');
  priceIn.type = 'text';
  priceIn.className = 'prop-item-price-input';
  priceIn.value = priceDisp || 'MP';
  priceIn.title = 'Type a price · Enter or Tab → next item · Shift+Tab → previous · Esc → cancel';

  // Track the value before editing starts so Escape can restore it
  let _prePriceEdit = '';
  priceIn.addEventListener('focus', () => {
    _prePriceEdit = item.price;
    priceIn.value = priceNum > 0 ? priceNum.toFixed(2) : '';
    priceIn.select();
  });

  // Commit the typed value — strips '$' so it works on both raw and formatted strings
  const _commitPrice = () => {
    const raw = priceIn.value.replace(/[^0-9.]/g, '');
    const p   = parseFloat(raw);
    item.price    = (!isNaN(p) && p >= 0) ? '$' + p.toFixed(2) : '';
    priceIn.value = item.price || 'MP';
    const pn2 = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
    totalSpan.textContent = pn2 > 0 && item.qty > 1
      ? 'x' + item.qty + ' = $' + (pn2 * item.qty).toLocaleString('en-US', {minimumFractionDigits:2})
      : '';
    propUpdateTotals();
  };

  priceIn.addEventListener('keydown', e => {
    // Enter or Tab → commit + move to next price field
    if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
      e.preventDefault();
      _commitPrice();
      const all  = [...document.querySelectorAll('#prop-items-list .prop-item-price-input')];
      const next = all[all.indexOf(priceIn) + 1];
      if (next) next.focus(); else priceIn.blur();

    // Shift+Tab → commit + move to previous price field
    } else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      _commitPrice();
      const all  = [...document.querySelectorAll('#prop-items-list .prop-item-price-input')];
      const prev = all[all.indexOf(priceIn) - 1];
      if (prev) prev.focus(); else priceIn.blur();

    // Escape → restore previous value without saving
    } else if (e.key === 'Escape') {
      e.preventDefault();
      item.price = _prePriceEdit;
      const prevNum = parseFloat((_prePriceEdit || '').replace(/[^0-9.]/g, '')) || 0;
      priceIn.value = prevNum > 0 ? '$' + prevNum.toFixed(2) : 'MP';
      totalSpan.textContent = prevNum > 0 && item.qty > 1
        ? 'x' + item.qty + ' = $' + (prevNum * item.qty).toLocaleString('en-US', {minimumFractionDigits:2})
        : '';
      propUpdateTotals();
      priceIn.blur();
    }
  });

  // Click-away also commits (handles mouse navigation between items)
  priceIn.addEventListener('blur', _commitPrice);
  const totalSpan = document.createElement('div');
  totalSpan.style.cssText = 'font-size:9px;color:var(--stone);text-align:right;white-space:nowrap;margin-top:1px;';
  totalSpan.textContent = priceNum > 0 && item.qty > 1 ? 'x'+item.qty+' = $'+(priceNum*item.qty).toLocaleString('en-US',{minimumFractionDigits:2}) : '';
  priceWrap.appendChild(priceIn);
  priceWrap.appendChild(totalSpan);
  rowA.appendChild(priceWrap);

  // Delete
  const del = document.createElement('button');
  del.className = 'prop-del-btn'; del.type = 'button';
  del.dataset.action = 'del'; del.dataset.id = item.id; del.textContent = '✕';
  del.title = 'Remove from proposal';
  rowA.appendChild(del);

  body.appendChild(rowA);

  // ── ROW B: Name ─────────────────────────────────────────────────────────────
  const nameIn = document.createElement('input');
  nameIn.type = 'text';
  nameIn.className = 'prop-item-name-input';
  nameIn.value = item.name;
  nameIn.placeholder = 'Item name';
  nameIn.title = 'Click to rename — this proposal only';
  nameIn.addEventListener('input',   () => { item.name = nameIn.value; });
  nameIn.addEventListener('keydown', e  => { if (e.key === 'Enter') descIn.focus(); });
  body.appendChild(nameIn);

  // ── ROW C: Description ───────────────────────────────────────────────────────
  const descIn = document.createElement('input');
  descIn.type = 'text';
  descIn.className = 'prop-item-desc-input';
  descIn.value = item.notes || '';
  descIn.placeholder = 'Description or location, e.g. "near entrance of building"…';
  descIn.title = 'Shows under the item name in the printed proposal';
  descIn.addEventListener('input',   () => { item.notes = descIn.value; });
  descIn.addEventListener('keydown', e  => { if (e.key === 'Enter') descIn.blur(); });
  body.appendChild(descIn);

  main.appendChild(body);
  row.appendChild(main);
  return row;
}

// ── RENDER GROUPED BY AREA ────────────────────────────────────────────────────
function propRenderGrouped() {
  const list = document.getElementById('prop-items-list');
  if (!list) return;
  list.innerHTML = '';

  // Always (re)attach delegated handler — survives innerHTML wipes
  list.onclick = function(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || e.target.tagName === 'INPUT') return;
    const id  = parseInt(btn.dataset.id, 10);
    const act = btn.dataset.action;
    if      (act === 'inc') propChangeQty(id,  1);
    else if (act === 'dec') propChangeQty(id, -1);
    else if (act === 'del') propRemove(id);
  };

  // Preserve area insertion order
  const areaOrder = [];
  const areaMap   = {};
  proposalItems.forEach(item => {
    const a = item.area || '';
    if (!areaMap[a]) { areaMap[a] = []; areaOrder.push(a); }
    areaMap[a].push(item);
  });

  areaOrder.forEach(area => {
    if (area) {
      const hdr = document.createElement('div');
      hdr.className = 'prop-area-header';
      hdr.textContent = area;
      list.appendChild(hdr);
    }
    areaMap[area].forEach(item => list.appendChild(buildItemRow(item)));
  });
}

// ── PROP RENDER (top-level entry point) ──────────────────────────────────────
function propRender() {
  const list    = document.getElementById('prop-items-list');
  const empty   = document.getElementById('prop-empty-msg');
  const totals  = document.getElementById('prop-totals');
  const counter = document.getElementById('prop-item-count');
  if (!list) return;

  if (empty)   empty.style.display  = proposalItems.length ? 'none' : '';
  if (totals)  totals.style.display = proposalItems.length ? ''     : 'none';
  if (counter) counter.textContent  = proposalItems.length + ' item' + (proposalItems.length !== 1 ? 's' : '');
  const badge = document.getElementById('prop-preview-count');
  if (badge) { badge.textContent = proposalItems.length; badge.style.display = proposalItems.length ? '' : 'none'; }

  // Show editing context — reads the live prop-client input rather than
  // fetching the saved record (propRender fires on nearly every keystroke;
  // the live value is both cheaper and more current than whatever was last
  // saved anyway).
  const editLabel = document.getElementById('prop-editing-label');
  if (editLabel) {
    if (window._propEditingKey) {
      const nameEl = document.getElementById('prop-client');
      const name = nameEl ? nameEl.value.trim() : '';
      editLabel.textContent = name ? '— editing: ' + name : '';
    } else {
      editLabel.textContent = '';
    }
  }

  propRenderGrouped();
  propUpdateTotals();
  _propScheduleDraft();
  if (typeof vizSplitRender === 'function') vizSplitRender();
  if (typeof _propUpdateSessionLink === 'function') _propUpdateSessionLink();
}

function propUpdateTotals() {
  const sub = proposalItems.reduce((acc, item) => {
    return acc + (parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0) * item.qty;
  }, 0);

  const shipRate  = parseFloat((document.getElementById('prop-ship-rate') || {value:'20'}).value) || 0;
  const taxRateIn = parseFloat((document.getElementById('prop-tax-rate')  || {value:'6'}).value)  || 0;

  const ship  = sub * (shipRate / 100);
  const tax   = (sub + ship) * (taxRateIn / 100);
  const total = sub + ship + tax;

  // Pull real payments from the in-memory cache (if a proposal is loaded) —
  // kept in sync by propLoadProposal/propNewBlank/propLogPayment/
  // propDeletePayment, never re-fetched here since this runs on nearly
  // every keystroke.
  const savedKey = window._propEditingKey || null;
  const payments = savedKey ? _propCurrentPayments : [];
  const totalPaid = payments.reduce((a, x) => a + (x.amount || 0), 0);
  const balance = Math.max(0, total - totalPaid);
  const isPaid  = balance <= 0 && total > 0;

  const fmt = n => '$' + n.toLocaleString('en-US', {minimumFractionDigits: 2});
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('prop-subtotal', fmt(sub));
  set('prop-shipping', fmt(ship));
  set('prop-tax',      fmt(tax));
  set('prop-total',    fmt(total));

  // Balance — colour red if owing, green if paid
  const balEl = document.getElementById('prop-balance');
  if (balEl) {
    balEl.textContent = isPaid ? '✓ Paid in Full' : fmt(balance);
    balEl.style.color = isPaid ? 'var(--sage-dark)' : '#B3261E';
  }

  const sl = document.getElementById('prop-ship-label');
  if (sl) sl.textContent = 'Shipping (' + shipRate + '%)';
  const tl = document.getElementById('prop-tax-label');
  if (tl) tl.textContent = 'Tax (' + taxRateIn + '% on sub+ship)';

  // Mirror values to proposal doc totals (if rendered)
  set('subtotal', fmt(sub));
  set('shipping', fmt(ship));
  set('tax',      fmt(tax));
  set('total',    fmt(total));

  // Render payment log in the builder panel
  const logEl = document.getElementById('prop-payment-log');
  if (logEl) {
    if (payments.length === 0) {
      logEl.innerHTML = '<div style="font-size:11px;color:var(--stone);font-style:italic;">No payments logged yet.</div>';
    } else {
      logEl.innerHTML = payments.map(pay => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:var(--sage-light);border-radius:5px;font-size:12px;">
          <span style="color:var(--sage-dark);font-weight:600;">${fmt(pay.amount)}</span>
          <span style="color:var(--stone);flex:1;margin:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(pay.note || 'Payment')} · ${escapeHtml(pay.date)}</span>
          <button onclick="propDeletePayment('${pay.id}')" style="background:none;border:none;cursor:pointer;color:var(--blush-mid);font-size:12px;padding:0;" title="Remove">✕</button>
        </div>`).join('');
    }
  }

  // Show "add payment" button only when proposal is saved
  const addPayBtn = document.getElementById('prop-add-pay-btn');
  if (addPayBtn) addPayBtn.style.display = savedKey ? '' : 'none';
  const paySection = document.getElementById('prop-payment-section');
  if (paySection) paySection.style.display = savedKey ? '' : 'none';
}

function propShowPaymentAdd() {
  const box = document.getElementById('prop-payment-add');
  if (box) { box.style.display = 'flex'; document.getElementById('prop-pay-amt').focus(); }
}

async function propLogPayment() {
  if (!window._propEditingKey) { alert('Save the proposal first, then log payments.'); return; }
  const amt  = parseFloat((document.getElementById('prop-pay-amt') || {value:''}).value);
  const note = (document.getElementById('prop-pay-note') || {value:''}).value.trim() || 'Payment';
  if (!amt || amt <= 0) {
    const el = document.getElementById('prop-pay-amt');
    if (el) { el.focus(); el.style.borderColor='var(--blush-mid)'; setTimeout(()=>el.style.borderColor='',1500); }
    return;
  }
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }

  const now = new Date();
  const { data, error } = await sb.from('proposal_payments').insert({
    proposal_id: window._propEditingKey, amount: amt, note, paid_on: now.toISOString().slice(0,10)
  }).select().single();
  if (error) { showToast('Could not log payment: ' + error.message, 'toast-error'); return; } // nothing added to the cache/ledger — no fake success

  _propCurrentPayments.push({
    id: data.id, amount: amt, note,
    date: now.toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}),
    isoDate: now.toISOString().slice(0,10)
  });

  // Also sync the stored total so My Proposals reflects current items — the
  // payment itself already succeeded and is visible in the ledger either way,
  // so this failing gets its own toast rather than undoing the payment log.
  const newTotal = proposalItems.reduce((a,i) => {
    const p = parseFloat((i.price||'').replace(/[^0-9.]/g,''))||0;
    return a + p * i.qty;
  }, 0) * (1 + (parseFloat((document.getElementById('prop-ship-rate')||{value:'20'}).value)||0)/100)
    * (1 + (parseFloat((document.getElementById('prop-tax-rate')||{value:'6'}).value)||0)/100);
  const { error: totalErr } = await sb.from('proposals').update({ total: newTotal }).eq('id', window._propEditingKey);
  if (totalErr) showToast('Payment logged, but could not sync the stored total: ' + totalErr.message, 'toast-error');

  // Reset add form
  const box = document.getElementById('prop-payment-add');
  if (box) box.style.display = 'none';
  document.getElementById('prop-pay-amt').value  = '';
  document.getElementById('prop-pay-note').value = '';

  propUpdateTotals(); // re-render ledger + balance (sync — reads _propCurrentPayments)
}

async function propDeletePayment(paymentId) {
  if (!confirm('Remove this payment?')) return;
  if (!sb) return;
  const { error } = await sb.from('proposal_payments').delete().eq('id', paymentId);
  if (error) { showToast('Could not remove payment: ' + error.message, 'toast-error'); return; }
  _propCurrentPayments = _propCurrentPayments.filter(p => p.id !== paymentId);
  propUpdateTotals();
}

async function propSave() {
  if (!proposalItems.length) { alert('Add some items first.'); return; }
  const gv = id => (document.getElementById(id) || {value:''}).value.trim();
  const clientName = gv('prop-client') || 'Unnamed';
  if (!sb) { alert('Not connected to Supabase.'); return; }

  // Compute totals for display in My Proposals
  const sub = proposalItems.reduce((a,i) => a + (parseFloat((i.price||'').replace(/[^0-9.]/g,''))||0)*i.qty, 0);
  const shipRate = parseFloat(gv('prop-ship-rate')||'20')||0;
  const taxRate  = parseFloat(gv('prop-tax-rate') ||'6') ||0;
  const ship = sub * shipRate / 100;
  const tax  = (sub + ship) * taxRate / 100;
  const total = sub + ship + tax;

  // Use existing id if we're editing a loaded proposal, else create new.
  // A single targeted fetch (not the full getSavedProposals() list+payments
  // join) — this only needs three fields off the one row being edited.
  const editingKey = window._propEditingKey || null;
  let existing = null;
  if (editingKey) {
    const { data } = await sb.from('proposals').select('status, client_id, mockup_image_url').eq('id', editingKey).maybeSingle();
    existing = data;
  }

  const fields = {
    client:  gv('prop-client'),  child:   gv('prop-child'),
    phone:   gv('prop-phone'),   email:   gv('prop-email'),
    date:    gv('prop-date'),    venue:   gv('prop-venue'),
    colors:  gv('prop-colors'),  planner: gv('prop-planner'),
    adults:  gv('prop-adults'),  kids:    gv('prop-kids'),
    pickup:  gv('prop-pickup'),  notes:   gv('prop-notes'),
  };
  const status = existing ? existing.status : 'draft';

  // Resolve/create the CRM client BEFORE writing the proposal — but unlike
  // the old localStorage version (one atomic blob write), this is now two
  // separate network writes, so a failure here must stop the save entirely
  // rather than pushing ahead with a possibly-stale clientId. Otherwise a
  // failed client upsert combined with a "successful" proposal save could
  // either orphan a proposal with no real client link, or (if the client
  // write half-succeeded) leave a client record with nothing pointing at it.
  const clientResult = await upsertCRMClient({
    clientName, fields, total, status,
    clientId: existing ? existing.client_id : null,
    key: editingKey
  });
  if (clientResult.error) {
    alert('Could not save the client record for this proposal, so the proposal itself was not saved either: ' + clientResult.error.message + '\n\nNothing was lost — your items and fields are still in the builder. Try saving again.');
    return;
  }

  const row = {
    client_id: clientResult.clientId,
    client_name: clientName,
    status,
    total,
    fields,
    schedule: getScheduleData(),
    ship_rate: shipRate,
    tax_rate: taxRate,
    deposit: parseFloat(gv('prop-deposit')) || 1000,
    items: proposalItems.map(i => ({id:i.id,name:i.name,cat:i.cat,price:i.price,sku:i.sku,qty:i.qty,notes:i.notes||'',area:i.area||'',imgSrc:i.imgSrc||'',isCustom:i.isCustom||false,isVenueItem:i.isVenueItem||false,fromAnalysis:i.fromAnalysis||false})),
    // Still a base64 data URL here, not a Storage URL — Venue Visualizer
    // (where window._vizProposalMockup comes from) doesn't move to Supabase
    // until Phase 3; converting this to a real upload belongs there, at the
    // source, not piecemeal here. Falls back to whatever's already stored so
    // re-saving a proposal (e.g. just editing the venue field) without
    // revisiting the Visualizer this session doesn't wipe an existing mockup.
    mockup_image_url: (typeof window !== 'undefined' && window._vizProposalMockup) || (existing && existing.mockup_image_url) || null
  };

  let proposalId = editingKey;
  let saveError;
  if (editingKey) {
    const { error } = await sb.from('proposals').update(row).eq('id', editingKey);
    saveError = error;
  } else {
    const { data: inserted, error } = await sb.from('proposals').insert(row).select().single();
    saveError = error;
    if (inserted) proposalId = inserted.id;
  }
  if (saveError) { alert('Could not save proposal: ' + saveError.message); return; }

  window._propEditingKey = proposalId;
  const btn = document.querySelector('[onclick="propSave()"]');
  if (btn) { const orig = btn.textContent; btn.textContent = '✓ Saved!'; btn.disabled = true; setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000); }
  showToast('✓ Proposal saved — ' + clientName, 'toast-success');
  localStorage.removeItem(DRAFT_KEY);
  _propSetSaveStatus('· Saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
}

function propDrop(e) { e.preventDefault(); }   // handled via addEventListener above

// ── PROPOSAL DRAFT AUTO-SAVE ─────────────────────────────────────────────────
const DRAFT_KEY = 'propDraft_v1';
let _propDraftTimer = null;
function _gv(id) { return (document.getElementById(id) || {value:''}).value.trim(); }

function _propScheduleDraft() {
  if (!proposalItems.length) return;
  clearTimeout(_propDraftTimer);
  _propDraftTimer = setTimeout(_propSaveDraft, 3500);
}

function _propSaveDraft() {
  if (!proposalItems.length) return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      key: window._propEditingKey || null,
      items: proposalItems.map(i => ({
        name:i.name, cat:i.cat, price:i.price, sku:i.sku, qty:i.qty,
        notes:i.notes||'', area:i.area||'', imgSrc:i.imgSrc||'',
        isCustom:i.isCustom||false, isVenueItem:i.isVenueItem||false
      })),
      fields: {
        client:_gv('prop-client'),  child:_gv('prop-child'),   phone:_gv('prop-phone'),
        email:_gv('prop-email'),    date:_gv('prop-date'),     venue:_gv('prop-venue'),
        colors:_gv('prop-colors'),  planner:_gv('prop-planner'),
        adults:_gv('prop-adults'),  kids:_gv('prop-kids'),
        pickup:_gv('prop-pickup'),  notes:_gv('prop-notes'),
      },
      shipRate: _gv('prop-ship-rate') || '20',
      taxRate:  _gv('prop-tax-rate')  || '6',
      ts: Date.now()
    }));
    _propSetSaveStatus('• Draft saved ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
  } catch(e) {}
}

function _propSetSaveStatus(msg) {
  const el = document.getElementById('prop-autosave-status');
  if (el) el.textContent = msg;
}

function _propRestoreDraft() {
  if (proposalItems.length || window._propEditingKey) return;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d || !d.items || !d.items.length) return;
    if (Date.now() - d.ts > 48 * 3600 * 1000) { localStorage.removeItem(DRAFT_KEY); return; }
    d.items.forEach(item => {
      propItemIdCounter++;
      proposalItems.push({
        id: propItemIdCounter, name:item.name, cat:item.cat, price:item.price,
        sku:item.sku, qty:item.qty||1, notes:item.notes||'', area:item.area||'',
        imgSrc:item.imgSrc||'', isCustom:item.isCustom||false, isVenueItem:item.isVenueItem||false
      });
    });
    if (d.key) window._propEditingKey = d.key;
    const flds = ['client','child','phone','email','date','venue','colors','planner','adults','kids','pickup','notes'];
    flds.forEach(f => { const el = document.getElementById('prop-' + f); if (el && d.fields) el.value = d.fields[f] || ''; });
    const sr = document.getElementById('prop-ship-rate'); if (sr) sr.value = d.shipRate || '20';
    const tr = document.getElementById('prop-tax-rate');  if (tr) tr.value = d.taxRate  || '6';
    propRender();
    _propSetSaveStatus('• Draft restored · ' + new Date(d.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}));
    showToast('Draft restored from ' + new Date(d.ts).toLocaleString(), 'toast-info');
  } catch(e) {}
}

// ── LEGACY STUBS (keep other parts of the app working) ────────────────────────
// Legacy compat for proposal-doc
function drag(e, name, icon, price) {}
function drop(e) {}
function addItem(name, icon, price) {}
function renderProposal() {}
function changeQty(i, d) {}
function removeItem(i) { propRemove(i); }
function clearProposal() { propClearAll(); }
function saveProposal() { propSave(); }
function updateSummary() { propUpdateTotals(); }

// ── LOAD SAVED PROPOSALS ─────────────────────────────────────────────────────
async function propShowSaved() {
  const all = await getSavedProposals();
  if (!all.length) { alert('No saved proposals yet. Build a proposal and click 💾 Save.'); return; }
  const _esc = escapeHtml;
  const rows = all.map(p => {
    const f = p.fields || {};
    const dateDisp = f.date ? new Date(f.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : (p.dateVal || 'No date');
    const venueDisp = f.venue || p.venue || 'No venue';
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);">
      <div style="flex:1;">
        <div style="font-size:13.5px;font-weight:600;">${_esc(p.clientName)}</div>
        <div style="font-size:11px;color:var(--stone);">${_esc(dateDisp)} · ${_esc(venueDisp)} · ${(p.items||[]).length} items · Saved ${_esc(p.savedAt||'')}</div>
      </div>
      <button class="btn btn-primary" style="font-size:12px;" onclick="propLoadProposal('${_esc(p.key)}');closeModal()">Load</button>
      <button class="btn btn-danger" style="font-size:12px;" onclick="propDeleteSavedByKey('${_esc(p.key)}')">✕</button>
    </div>`;
  }).join('');
  document.getElementById('modal-content').innerHTML =
    '<div class="modal-title">Saved Proposals</div>' + rows +
    '<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button></div>';
  document.getElementById('modal-overlay').classList.add('open');
}

async function propDeleteSavedByKey(key) {
  if (!confirm('Delete this proposal?')) return;
  if (!sb) return;
  const { error } = await sb.from('proposals').delete().eq('id', key); // cascades to proposal_payments
  if (error) { showToast('Could not delete proposal: ' + error.message, 'toast-error'); return; }
  propShowSaved();
}

async function propLoadProposal(key) {
  const all = await getSavedProposals();
  const p = typeof key === 'number' ? all[key] : all.find(x => x.key === key);
  if (!p) return;
  window._propEditingKey = p.key; // track which proposal we're editing
  _savedProp = p;
  _propCurrentPayments = p.payments || []; // repopulate the builder's payment-ledger cache for this proposal
  await _propRefreshHasLinkedSession(p.key); // ditto for the session-link cache, before propRender() reads it
  const setVal = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  const f = p.fields || {};
  setVal('prop-client',    f.client   || p.clientName || '');
  setVal('prop-child',     f.child    || '');
  setVal('prop-phone',     f.phone    || '');
  setVal('prop-email',     f.email    || '');
  setVal('prop-date',      f.date     || p.dateVal || '');
  setVal('prop-venue',     f.venue    || p.venue || '');
  setVal('prop-colors',    f.colors   || '');
  setVal('prop-planner',   f.planner  || '');
  setVal('prop-adults',    f.adults   || '');
  setVal('prop-kids',      f.kids     || '');
  setVal('prop-pickup',    f.pickup   || '');
  setVal('prop-notes',     f.notes    || '');
  setScheduleData(p.schedule || []);
  setVal('prop-ship-rate', p.shipRate || '20');
  setVal('prop-tax-rate',  p.taxRate  || '6');
  setVal('prop-deposit',   p.deposit  || '1000');
  proposalItems = [];
  propItemIdCounter = 0;
  (p.items || []).forEach(item => {
    propItemIdCounter++;
    proposalItems.push({ id: propItemIdCounter, name: item.name, cat: item.cat, price: item.price, sku: item.sku, qty: item.qty || 1, notes: item.notes || '', area: item.area || '', imgSrc: item.imgSrc || '', isCustom: item.isCustom || false, isVenueItem: item.isVenueItem || false, fromAnalysis: item.fromAnalysis || false });
  });
  propRender();
  propUpdateTotals();
  closeModal();
  navigate('proposals');
}

// Clear editing key when starting fresh
function propNewBlank() {
  if (proposalItems.length > 0 && !confirm('Start a new blank proposal? The current ' + proposalItems.length + ' item' + (proposalItems.length !== 1 ? 's' : '') + ' will be cleared.')) return;
  window._propEditingKey = null;
  _savedProp = null;
  window._vizProposalMockup = null;  // clear any attached mockup
  proposalItems = [];
  propItemIdCounter = 0;
  _propCurrentPayments = []; // no proposal loaded — nothing for the builder's payment ledger to show
  _propHasLinkedSession = false; // ditto for the session-link cache
  propRender();
  ['prop-client','prop-child','prop-phone','prop-email','prop-date','prop-venue','prop-colors','prop-planner','prop-adults','prop-kids','prop-pickup','prop-notes'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  setScheduleData([]);
  navigate('proposals');
}

// ── PROPOSAL SAVE TOAST ──────────────────────────────────────────────────────
// Patch propSave to also fire a toast (called from Ctrl+S where no button is visible)
const _origPropSave = typeof propSave === 'function' ? propSave : null;


// ── Sync proposal builder fields to the doc form ─────────────────────────────
// ── DYNAMIC SCHEDULE ─────────────────────────────────────────────────────────
let scheduleRows = [];   // [{id, phase, setup, start, end, pickup}]
let schedRowCounter = 0;

function propAddScheduleRow(phase) {
  schedRowCounter++;
  const id = schedRowCounter;
  scheduleRows.push({ id, phase: phase || '', setup: '', start: '', end: '', pickup: '' });
  renderScheduleRows();
}

function propRemoveScheduleRow(id) {
  scheduleRows = scheduleRows.filter(r => r.id !== id);
  renderScheduleRows();
}

function renderScheduleRows() {
  const container = document.getElementById('prop-schedule-rows');
  if (!container) return;
  container.innerHTML = '';

  const PHASE_SUGGESTIONS = ['Ceremony','Cocktail Hour','Reception','Dinner','Party','Setup Only','Teen Area','Kids Area','Photo Booth','After Party','Other'];

  if (scheduleRows.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--stone);padding:4px 0 8px;font-style:italic;">No phases added yet. Click + Add Phase above.</div>';
    return;
  }

  scheduleRows.forEach(row => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr 24px;gap:6px;align-items:end;margin-bottom:8px;';

    function field(labelText, key, placeholder) {
      const d = document.createElement('div');
      d.className = 'prop-field';
      d.innerHTML = '<label>' + labelText + '</label>';
      const inp = document.createElement('input');
      inp.placeholder = placeholder;
      inp.value = row[key] || '';
      inp.addEventListener('input', () => { row[key] = inp.value; });
      // For phase, use datalist
      if (key === 'phase') {
        inp.setAttribute('list', 'prop-phase-datalist');
        if (!document.getElementById('prop-phase-datalist')) {
          const dl = document.createElement('datalist');
          dl.id = 'prop-phase-datalist';
          PHASE_SUGGESTIONS.forEach(s => { const o = document.createElement('option'); o.value = s; dl.appendChild(o); });
          document.body.appendChild(dl);
        }
      }
      d.appendChild(inp);
      return d;
    }

    wrap.appendChild(field('Phase / Event', 'phase', 'e.g. Reception'));
    wrap.appendChild(field('Setup', 'setup', '7:00 PM'));
    wrap.appendChild(field('Start', 'start', '8:00 PM'));
    wrap.appendChild(field('End', 'end', '11:00 PM'));
    wrap.appendChild(field('Pick-Up', 'pickup', '12:00 AM'));

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.style.cssText = 'background:none;border:none;color:var(--stone);cursor:pointer;font-size:14px;padding:0;align-self:center;margin-top:14px;';
    del.onclick = () => propRemoveScheduleRow(row.id);
    wrap.appendChild(del);

    container.appendChild(wrap);
  });
}

function getScheduleData() {
  return scheduleRows.map(r => ({...r}));
}

function setScheduleData(rows) {
  scheduleRows = rows ? rows.map((r, i) => ({ id: ++schedRowCounter, ...r })) : [];
  renderScheduleRows();
}

function propSyncToDoc() {
  // Flush any focused input so in-progress edits are committed to proposalItems
  if (document.activeElement && document.activeElement.tagName === 'INPUT') {
    document.activeElement.blur();
  }
  const map = [
    ['prop-client',  'pd-client'],
    ['prop-child',   'pd-child'],
    ['prop-phone',   'pd-phone'],
    ['prop-email',   'pd-email'],
    ['prop-venue',   'pd-venue'],
    ['prop-date',    'pd-date'],
    ['prop-colors',  'pd-theme'],
    ['prop-planner', 'pd-planner'],
    ['prop-notes',   'pd-notes'],
    ['prop-adults',  'pd-adults'],
    ['prop-kids',    'pd-kids'],
    ['prop-pickup',  'pd-pickup'],
  ];
  map.forEach(([src, dst]) => {
    const srcEl = document.getElementById(src);
    const dstEl = document.getElementById(dst);
    if (srcEl && dstEl) dstEl.value = srcEl.value || '';
  });
  // Schedule rows are read directly by renderProposalDoc via getScheduleData()
}
