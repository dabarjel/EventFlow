// Venue Visualizer: Analyze Event Photo (item detection, crop editor, results).

// ══════════════════════════════════════════════════════════════════════════════
// ── ANALYZE EVENT PHOTO ───────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let vzaState = { imgSrc: null, imgEl: null, items: [], addedCount: 0 };

function vizGoToAnalyze() {
  vizShowStage('analyze');
  vzaState = { imgSrc: vzaState.imgSrc, imgEl: vzaState.imgEl, items: [], addedCount: 0 };
  const grid = document.getElementById('vza-results-grid');
  if (grid) grid.innerHTML = '';
  const status = document.getElementById('vza-status');
  if (status) status.textContent = vzaState.imgSrc ? 'Photo loaded — click Identify Items.' : 'Upload a photo to begin.';
  const addAllBtn2   = document.getElementById('vza-add-all-btn');
  const matchAllBtn2 = document.getElementById('vza-match-all-btn');
  if (addAllBtn2)   addAllBtn2.style.display = 'none';
  if (matchAllBtn2) matchAllBtn2.style.display = 'none';
  const countEl = document.getElementById('vza-added-count');
  if (countEl) countEl.textContent = '';
  // Clean up any active crop editor
  vzaCropEditorCleanup();
  const editorWrap = document.getElementById('vza-crop-editor-wrap');
  if (editorWrap) editorWrap.style.display = 'none';
}

function vzaHandleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  resizeImageFile(file, 800, 0.8).then(dataUrl => {
    vzaState.imgSrc = dataUrl;
    const thumb = document.getElementById('vza-thumb');
    if (thumb) { thumb.src = vzaState.imgSrc; thumb.style.display = 'block'; }
    const ph = document.getElementById('vza-upload-ph');
    if (ph) ph.style.display = 'none';
    const btn = document.getElementById('vza-analyze-btn');
    if (btn) btn.disabled = false;
    const status = document.getElementById('vza-status');
    if (status) status.textContent = 'Photo ready — click Identify Items.';
    vizScheduleSave();
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not process that image — try a different file', 'toast-error');
  });
}

async function vzaAnalyzePhoto() {
  if (!vzaState.imgSrc) return;

  const btn      = document.getElementById('vza-analyze-btn');
  const status   = document.getElementById('vza-status');
  const grid     = document.getElementById('vza-results-grid');
  const addAllBtn   = document.getElementById('vza-add-all-btn');
  const matchAllBtn = document.getElementById('vza-match-all-btn');

  if (btn)      { btn.textContent = 'Analyzing…'; btn.disabled = true; }
  if (status)   status.textContent = 'Sending image to Claude for analysis…';
  if (grid)     grid.innerHTML = '';
  if (addAllBtn)   addAllBtn.style.display = 'none';
  if (matchAllBtn) matchAllBtn.style.display = 'none';

  const m = vzaState.imgSrc.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) { if (status) status.textContent = 'Invalid image.'; return; }
  const [, mime, b64] = m;

  try {
    // ── Step 1: ping test — confirm API connectivity with a trivial text-only call ──
    console.log('[VZA] Starting analysis. MIME:', mime, '| b64 length:', b64.length);
    if (status) status.textContent = 'Verifying API connection…';

    const pingData = await _vizAiProxy('anthropic', {
      model:'claude-opus-4-6', max_tokens:20, messages:[{ role:'user', content:'Reply with the single word: ok' }]
    });
    console.log('[VZA] Ping response:', JSON.stringify(pingData).slice(0, 200));

    // ── Step 2: full image analysis ───────────────────────────────────────────
    if (status) status.textContent = 'Sending image to Claude for analysis…';
    const data = await _vizAiProxy('anthropic', {
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
        { type: 'text', text: 'You are an event rental specialist writing for a luxury event company\'s proposal system. Identify the 10 most prominent rentable items in this photo (furniture, lighting, draping, centerpieces, décor, staging, bars, chairs, tables, etc.).\n\nFor each item return: name (specific, include color and material if visible), category, quantity (integer), description (2–3 elegant sentences: first sentence names the item with its color and material; second sentence describes how it contributes to the event aesthetic; optional third sentence notes quantity or arrangement if relevant — do NOT truncate), and region (x, y, w, h as percentage of image dimensions).\n\nExample description: "Six plush navy velvet Chesterfield sofas arranged in an intimate lounge configuration. Their tufted design and rich upholstery anchor the sophisticated aesthetic with a touch of classic elegance. Grouped in pairs to encourage conversation around the dance floor."\n\nReturn ONLY a raw JSON array — no markdown, no explanation, no extra text.\nExample format: [{"name":"Gold Chiavari Chair","category":"Seating","quantity":8,"description":"…","region":{"x":10,"y":40,"w":20,"h":35}}]' }
      ]}]
    });
    console.log('[VZA] Full API response object:', data);

    const rawText = data.content && data.content[0] ? data.content[0].text : '';
    console.log('[VZA] Raw content[0].text (first 500 chars):', rawText.slice(0, 500));
    console.log('[VZA] stop_reason:', data.stop_reason, '| content blocks:', data.content && data.content.length);

    // ── Step 3: strip markdown fences (all variants) ──────────────────────────
    let raw = rawText.trim();
    raw = raw.replace(/^```(?:json|JSON)?\s*/,'').replace(/\s*```\s*$/,'').trim();

    const firstBracket = raw.indexOf('[');
    const firstBrace   = raw.indexOf('{');
    if (firstBracket === -1 && firstBrace === -1) {
      console.error('[VZA] No JSON structure found. Full raw text:', rawText);
      if (status) status.innerHTML = 'Claude returned non-JSON text.<br><small style="font-size:var(--fs-2xs);opacity:0.8">' + escapeHtml(rawText.slice(0, 120)) + '…</small>';
      throw new Error('No JSON in response — see status bar for details');
    }

    // ── Step 4: parse — full parse first, then partial-object recovery ────────
    let items;
    try {
      items = JSON.parse(raw);
      console.log('[VZA] JSON.parse succeeded. Type:', typeof items, Array.isArray(items) ? '(array, len=' + items.length + ')' : '(object)');
    } catch(parseErr) {
      console.error('[VZA] JSON.parse failed:', parseErr.message);
      console.error('[VZA] Text that failed to parse (first 800):', raw.slice(0, 800));

      // Try greedy array extraction first
      const arrM = raw.match(/\[[\s\S]*\]/);
      if (arrM) {
        try { items = JSON.parse(arrM[0]); console.log('[VZA] Greedy array extraction succeeded, len:', items.length); }
        catch(e2) {
          console.warn('[VZA] Greedy array parse failed too — attempting partial-object recovery');
          // ── Partial-object recovery: collect every complete {...} block ────
          items = vzaExtractCompleteObjects(raw);
          console.log('[VZA] Partial recovery yielded', items.length, 'complete objects');
        }
      } else {
        // No array wrapper — try partial recovery directly
        items = vzaExtractCompleteObjects(raw);
        console.log('[VZA] No array found; partial recovery yielded', items.length, 'objects');
      }

      if (!items || !items.length) {
        if (status) status.innerHTML = 'JSON parse error: ' + escapeHtml(parseErr.message) + '<br><small style="font-size:var(--fs-2xs);opacity:0.8">' + escapeHtml(raw.slice(0,120)) + '…</small>';
        throw new Error('JSON parse error: ' + parseErr.message);
      }
    }

    // ── Step 5: normalise to array (handle object wrappers) ───────────────────
    if (items && !Array.isArray(items)) {
      console.log('[VZA] Response is an object, not array. Keys:', Object.keys(items));
      const inner = items.items || items.rentals || items.data || items.results || items.objects || items.inventory;
      if (Array.isArray(inner)) { console.log('[VZA] Found array under key, length:', inner.length); items = inner; }
      else { console.log('[VZA] Wrapping single object as one-item array'); items = [items]; }
    }

    console.log('[VZA] Final items array length:', items.length);
    if (!Array.isArray(items) || !items.length) {
      if (status) status.textContent = 'Claude returned an empty list — try a different photo or prompt.';
      throw new Error('No items returned');
    }

    // Load image element for cropping
    vzaState.imgEl = new Image();
    vzaState.imgEl.src = vzaState.imgSrc;
    await new Promise((res, rej) => { vzaState.imgEl.onload = res; vzaState.imgEl.onerror = rej; });

    vzaState.items = items.map((item, i) => ({
      id: i,
      name:        (item.name     || 'Item').trim(),
      category:    (item.category || 'Other').trim(),
      qty:         parseInt(item.quantity || item.qty) || 1,
      description: (item.description || '').trim(),
      region:      item.region || { x:5, y:5, w:30, h:30 },
      colorIdx:    i,
      thumbSrc:    null,
      added:       false,
      skipped:     false
    }));

    if (status) status.textContent = vzaState.items.length + ' items identified — adjust crop boxes, then confirm';
    vzaShowCropEditor();
    vizScheduleSave();

  } catch(e) {
    console.error('[VZA] Analysis failed:', e);
    // Only set status if it hasn't already been set to a detailed message above
    if (status && !status.innerHTML.includes('<small')) {
      status.textContent = 'Analysis failed: ' + e.message;
    }
    showToast('Analysis failed: ' + e.message, 'toast-error');
  } finally {
    if (btn) { btn.textContent = '✦ Identify Items'; btn.disabled = !vzaState.imgSrc; }
  }
}

// Scan raw text for complete JSON objects {...} — handles truncated arrays from max_tokens cuts.
// Returns an array of successfully parsed objects, skipping anything that won't parse.
function vzaExtractCompleteObjects(text) {
  const results = [];
  let depth = 0, start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    // Skip characters inside strings to avoid counting braces within them
    if (ch === '"') {
      i++;
      while (i < text.length && !(text[i] === '"' && text[i-1] !== '\\')) i++;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1);
        try { results.push(JSON.parse(candidate)); } catch(e) { /* skip malformed */ }
        start = -1;
      }
    }
  }
  return results;
}

function vzaCropRegion(item) {
  if (!vzaState.imgEl) return '';
  const img = vzaState.imgEl;
  const W = img.naturalWidth  || 800;
  const H = img.naturalHeight || 600;
  const r = item.region || {};

  const rw = Math.max(40, ((r.w || 25) / 100) * W);
  const rh = Math.max(30, ((r.h || 25) / 100) * H);
  const padX = rw * 0.12;
  const padY = rh * 0.12;

  // Apply 12% padding then clamp to image bounds
  const sx = Math.max(0, ((r.x || 0) / 100) * W - padX);
  const sy = Math.max(0, ((r.y || 0) / 100) * H - padY);
  const sw = Math.min(rw + padX * 2, W - sx);
  const sh = Math.min(rh + padY * 2, H - sy);

  // Output canvas preserving aspect ratio, max 400px on longest side
  const ratio = sw / sh;
  const MAX = 400;
  const outW = ratio >= 1 ? MAX : Math.round(MAX * ratio);
  const outH = ratio >= 1 ? Math.round(MAX / ratio) : MAX;

  const canvas = document.createElement('canvas');
  canvas.width = outW; canvas.height = outH;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas.toDataURL('image/jpeg', 0.90);
}

function vzaFuzzyMatch(name, category) {
  const cards = document.querySelectorAll('#inv-grid .inv-card');
  if (!cards.length) return { confidence: 'none', match: null };
  const norm  = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g,' ').trim();
  const toks  = s => norm(s).split(' ').filter(t => t.length > 2 && !['and','the','for','with','per','set','each'].includes(t));
  const catN  = norm(category);
  const nameT = toks(name);
  let bestScore = 0, bestCard = null;
  cards.forEach(card => {
    const cn = card.dataset.name || '';
    const cc = card.dataset.cat  || '';
    let score = 0;
    if (norm(cc) === catN) score += 35;
    else if (norm(cc).includes(catN) || catN.includes(norm(cc))) score += 18;
    const ct = toks(cn);
    nameT.forEach(t => { if (ct.includes(t)) score += 14; });
    if (norm(cn).includes(norm(name)) || norm(name).includes(norm(cn))) score += 22;
    if (score > bestScore) { bestScore = score; bestCard = card; }
  });
  if (!bestCard || bestScore < 22) return { confidence: 'none', match: null };
  const conf = bestScore >= 50 ? 'strong' : bestScore >= 30 ? 'possible' : 'none';
  if (conf === 'none') return { confidence: 'none', match: null };
  const imgEl = bestCard.querySelector('.inv-img img');
  return {
    confidence: conf,
    match: {
      name:   bestCard.dataset.name  || '',
      price:  bestCard.dataset.price || 'MP',
      sku:    bestCard.dataset.sku   || '',
      cat:    bestCard.dataset.cat   || '',
      imgSrc: imgEl ? (imgEl.src || '') : ''
    }
  };
}

// ── CROP EDITOR ───────────────────────────────────────────────────────────────

const VZA_BOX_COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316','#14B8A6','#6366F1'];
let _vzaCropSel        = null;
let _vzaCropDrag       = null;
let _vzaNewStart       = null;
let _vzaNewBoxN        = 0;
let _vzaCropMode       = 'draw';   // 'draw' | 'select'
let _vzaDragHistPushed = false;
let _vzaNameHistPushed = false;
let _vzaUndoStack      = [];
let _vzaRedoStack      = [];
const VZA_UNDO_MAX     = 20;

function vzaHistoryPush() {
  const snap = vzaState.items.map(i => ({ ...i, region: { ...i.region } }));
  _vzaUndoStack.push(snap);
  if (_vzaUndoStack.length > VZA_UNDO_MAX) _vzaUndoStack.shift();
  _vzaRedoStack = [];
}

function vzaUndo() {
  if (!_vzaUndoStack.length) return;
  _vzaRedoStack.push(vzaState.items.map(i => ({ ...i, region: { ...i.region } })));
  vzaState.items = _vzaUndoStack.pop();
  vzaRenderCropBoxes();
  if (_vzaCropSel !== null && !vzaState.items.find(i => i.id === _vzaCropSel)) vzaCropDeselect();
  else if (_vzaCropSel !== null) vzaCropSelect(_vzaCropSel);
  vzaUpdateCropCount();
  vzaFlashUndoRedo('Undo');
}

function vzaRedo() {
  if (!_vzaRedoStack.length) return;
  _vzaUndoStack.push(vzaState.items.map(i => ({ ...i, region: { ...i.region } })));
  vzaState.items = _vzaRedoStack.pop();
  vzaRenderCropBoxes();
  if (_vzaCropSel !== null && !vzaState.items.find(i => i.id === _vzaCropSel)) vzaCropDeselect();
  else if (_vzaCropSel !== null) vzaCropSelect(_vzaCropSel);
  vzaUpdateCropCount();
  vzaFlashUndoRedo('Redo');
}

function vzaFlashUndoRedo(text) {
  let el = document.getElementById('vza-undo-toast');
  if (!el) {
    el = document.createElement('div'); el.id = 'vza-undo-toast';
    el.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:var(--surface-raised);color:var(--text);border:1px solid var(--border-strong);padding:6px 20px;border-radius:var(--radius-full);font-size:var(--fs-xs);font-weight:var(--weight-medium);pointer-events:none;z-index:9999;opacity:0;transition:opacity var(--duration-fast);';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 850);
}

function vzaSetMode(mode) {
  _vzaCropMode = mode;
  const drawBtn   = document.getElementById('vza-mode-draw');
  const selectBtn = document.getElementById('vza-mode-select');
  if (drawBtn)   drawBtn.classList.toggle('active',   mode === 'draw');
  if (selectBtn) selectBtn.classList.toggle('active', mode === 'select');
  const wrap = document.getElementById('vza-crop-img-wrap');
  if (wrap) wrap.style.cursor = mode === 'draw' ? 'crosshair' : 'default';
}

function vzaStartOver() {
  const hasWork = vzaState.imgSrc || vzaState.items.length || document.getElementById('vza-results-grid').innerHTML.trim();
  if (hasWork && !confirm('Start over? All current crops and results will be lost.')) return;
  localStorage.removeItem(VIZ_PERSIST_KEY);
  vzaState = { imgSrc: null, imgEl: null, items: [], addedCount: 0 };
  _vzaUndoStack = []; _vzaRedoStack = [];
  // Reset file input so same file can be re-uploaded
  const fi = document.getElementById('vza-file-input'); if (fi) fi.value = '';
  // Reset upload zone UI
  const thumb = document.getElementById('vza-thumb'); if (thumb) { thumb.style.display = 'none'; thumb.src = ''; }
  const ph = document.getElementById('vza-upload-ph'); if (ph) ph.style.display = '';
  const analyzeBtn = document.getElementById('vza-analyze-btn'); if (analyzeBtn) { analyzeBtn.disabled = true; analyzeBtn.textContent = '✦ Identify Items'; }
  const status = document.getElementById('vza-status'); if (status) status.textContent = 'Upload a photo to begin.';
  // Clear results and crop editor
  const grid = document.getElementById('vza-results-grid'); if (grid) grid.innerHTML = '';
  vzaCropEditorCleanup();
  const ew = document.getElementById('vza-crop-editor-wrap'); if (ew) ew.style.display = 'none';
  const addAllBtn  = document.getElementById('vza-add-all-btn');  if (addAllBtn)  addAllBtn.style.display  = 'none';
  const matchAllBtn= document.getElementById('vza-match-all-btn'); if (matchAllBtn) matchAllBtn.style.display = 'none';
  const countEl = document.getElementById('vza-added-count'); if (countEl) countEl.textContent = '';
}

function vzaShowCropEditor() {
  const img = document.getElementById('vza-crop-img');
  if (img) img.src = vzaState.imgSrc;
  const catSel = document.getElementById('vza-crop-sb-cat');
  if (catSel) {
    catSel.innerHTML = '';
    INV_CATEGORIES.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o); });
  }
  _vzaUndoStack = []; _vzaRedoStack = [];
  vzaRenderCropBoxes();
  vzaUpdateCropCount();
  document.getElementById('vza-crop-editor-wrap').style.display = '';
  vzaSetMode('draw');
  document.addEventListener('mousemove', _vzaCropMove);
  document.addEventListener('mouseup',   _vzaCropUp);
  document.addEventListener('keydown',   _vzaCropKey);
}

function vzaCropEditorCleanup() {
  document.removeEventListener('mousemove', _vzaCropMove);
  document.removeEventListener('mouseup',   _vzaCropUp);
  document.removeEventListener('keydown',   _vzaCropKey);
  _vzaCropSel = null; _vzaCropDrag = null; _vzaNewStart = null;
  _vzaDragHistPushed = false; _vzaNameHistPushed = false;
}

function vzaRenderCropBoxes() {
  const wrap = document.getElementById('vza-crop-img-wrap');
  if (!wrap) return;
  Array.from(wrap.querySelectorAll('.vza-crop-box')).forEach(el => el.remove());
  vzaState.items.forEach(item => wrap.appendChild(vzaMakeCropBox(item)));
}

function vzaMakeCropBox(item) {
  const color = VZA_BOX_COLORS[item.colorIdx % VZA_BOX_COLORS.length];
  const r = item.region;
  const box = document.createElement('div');
  box.id = 'vza-box-' + item.id;
  box.className = 'vza-crop-box';
  box.dataset.id = String(item.id);
  box.style.cssText = `left:${r.x}%;top:${r.y}%;width:${r.w}%;height:${r.h}%;border:2.5px solid ${color};background:${color}26;`;

  box.addEventListener('mousedown', e => {
    e.stopPropagation();
    if (e.target.dataset.corner) { vzaCropStartDrag(e, item.id, e.target.dataset.corner); return; }
    if (e.target.classList.contains('vza-crop-x-btn')) return;
    vzaCropStartDrag(e, item.id, 'move');
  });
  box.addEventListener('click', e => { if (!e.target.classList.contains('vza-crop-x-btn')) vzaCropSelect(item.id); });
  box.addEventListener('dblclick', e => { vzaCropSelect(item.id); setTimeout(() => { const n = document.getElementById('vza-crop-sb-name'); if (n) { n.select(); n.focus(); } }, 20); });

  // Label
  const lbl = document.createElement('div');
  lbl.className = 'vza-crop-label'; lbl.id = 'vza-lbl-' + item.id;
  lbl.style.background = color; lbl.textContent = item.name;
  box.appendChild(lbl);

  // × button
  const xBtn = document.createElement('div');
  xBtn.className = 'vza-crop-x-btn'; xBtn.textContent = '×';
  xBtn.style.borderColor = color; xBtn.style.color = color;
  xBtn.addEventListener('mousedown', e => e.stopPropagation());
  xBtn.addEventListener('click', e => { e.stopPropagation(); vzaCropDeleteBox(item.id); });
  box.appendChild(xBtn);

  // 4 corner handles
  ['nw','ne','sw','se'].forEach(c => {
    const h = document.createElement('div');
    h.className = 'vza-crop-handle'; h.dataset.corner = c;
    h.style.borderColor = color;
    box.appendChild(h);
  });

  return box;
}

function vzaCropUpdateBox(id) {
  const item = vzaState.items.find(i => i.id === id);
  const box  = document.getElementById('vza-box-' + id);
  if (!item || !box) return;
  const r = item.region;
  box.style.left = r.x + '%'; box.style.top  = r.y + '%';
  box.style.width= r.w + '%'; box.style.height= r.h + '%';
}

function vzaCropSelect(id) {
  if (_vzaCropSel !== null) {
    const prev = document.getElementById('vza-box-' + _vzaCropSel);
    if (prev) prev.classList.remove('vza-selected');
  }
  _vzaCropSel = id; _vzaNameHistPushed = false;
  const box = document.getElementById('vza-box-' + id);
  if (box) box.classList.add('vza-selected');
  const item = vzaState.items.find(i => i.id === id);
  document.getElementById('vza-crop-sb-empty').style.display = 'none';
  document.getElementById('vza-crop-sb-form').classList.add('active');
  const nameEl = document.getElementById('vza-crop-sb-name');
  const catEl  = document.getElementById('vza-crop-sb-cat');
  if (nameEl && item) nameEl.value = item.name;
  if (catEl  && item) catEl.value  = item.category;
}

function vzaCropDeselect() {
  if (_vzaCropSel !== null) {
    const prev = document.getElementById('vza-box-' + _vzaCropSel);
    if (prev) prev.classList.remove('vza-selected');
  }
  _vzaCropSel = null; _vzaNameHistPushed = false;
  document.getElementById('vza-crop-sb-empty').style.display = '';
  document.getElementById('vza-crop-sb-form').classList.remove('active');
}

function vzaCropDeleteBox(id) {
  vzaHistoryPush();
  vzaState.items = vzaState.items.filter(i => i.id !== id);
  const box = document.getElementById('vza-box-' + id);
  if (box) box.remove();
  if (_vzaCropSel === id) vzaCropDeselect();
  vzaUpdateCropCount();
  vizScheduleSave();
}

function vzaDeleteSelected() { if (_vzaCropSel !== null) vzaCropDeleteBox(_vzaCropSel); }

function vzaCropSbNameChange(val) {
  if (_vzaCropSel === null) return;
  if (!_vzaNameHistPushed) { vzaHistoryPush(); _vzaNameHistPushed = true; }
  const item = vzaState.items.find(i => i.id === _vzaCropSel);
  if (item) item.name = val;
  const lbl = document.getElementById('vza-lbl-' + _vzaCropSel);
  if (lbl) lbl.textContent = val;
  vizScheduleSave();
}

function vzaCropSbCatChange(val) {
  if (_vzaCropSel === null) return;
  vzaHistoryPush();
  const item = vzaState.items.find(i => i.id === _vzaCropSel);
  if (item) item.category = val;
  vizScheduleSave();
}

function vzaWrapMousedown(e) {
  if (e.target.closest('.vza-crop-box')) return;
  e.preventDefault();
  if (_vzaCropMode === 'draw') {
    const wrap = document.getElementById('vza-crop-img-wrap');
    const rc = wrap.getBoundingClientRect();
    _vzaNewStart = {
      px: Math.max(0, Math.min(100, (e.clientX - rc.left) / rc.width  * 100)),
      py: Math.max(0, Math.min(100, (e.clientY - rc.top)  / rc.height * 100))
    };
  } else {
    vzaCropDeselect();
  }
}

function vzaCropStartDrag(e, id, mode) {
  e.preventDefault();
  vzaCropSelect(id);
  const item = vzaState.items.find(i => i.id === id);
  if (!item) return;
  const wrap = document.getElementById('vza-crop-img-wrap');
  const rc = wrap.getBoundingClientRect();
  _vzaDragHistPushed = false;
  _vzaCropDrag = {
    id, mode,
    spx: (e.clientX - rc.left) / rc.width  * 100,
    spy: (e.clientY - rc.top)  / rc.height * 100,
    orig: { ...item.region }
  };
}

function _vzaCropMove(e) {
  const wrap = document.getElementById('vza-crop-img-wrap');
  if (!wrap) return;
  const rc = wrap.getBoundingClientRect();
  const px = (e.clientX - rc.left) / rc.width  * 100;
  const py = (e.clientY - rc.top)  / rc.height * 100;

  if (_vzaCropDrag) {
    if (!_vzaDragHistPushed) { vzaHistoryPush(); _vzaDragHistPushed = true; }
    const dx = px - _vzaCropDrag.spx, dy = py - _vzaCropDrag.spy;
    const o  = _vzaCropDrag.orig;
    const item = vzaState.items.find(i => i.id === _vzaCropDrag.id);
    if (!item) return;
    const MIN = 4, r = item.region;
    if (_vzaCropDrag.mode === 'move') {
      r.x = Math.max(0, Math.min(100 - o.w, o.x + dx));
      r.y = Math.max(0, Math.min(100 - o.h, o.y + dy));
    } else if (_vzaCropDrag.mode === 'se') {
      r.w = Math.max(MIN, Math.min(100 - o.x, o.w + dx));
      r.h = Math.max(MIN, Math.min(100 - o.y, o.h + dy));
    } else if (_vzaCropDrag.mode === 'sw') {
      const nw = Math.max(MIN, o.w - dx); r.x = Math.max(0, o.x + o.w - nw); r.w = nw;
      r.h = Math.max(MIN, Math.min(100 - o.y, o.h + dy));
    } else if (_vzaCropDrag.mode === 'ne') {
      r.w = Math.max(MIN, Math.min(100 - o.x, o.w + dx));
      const nh = Math.max(MIN, o.h - dy); r.y = Math.max(0, o.y + o.h - nh); r.h = nh;
    } else if (_vzaCropDrag.mode === 'nw') {
      const nw = Math.max(MIN, o.w - dx); r.x = Math.max(0, o.x + o.w - nw); r.w = nw;
      const nh = Math.max(MIN, o.h - dy); r.y = Math.max(0, o.y + o.h - nh); r.h = nh;
    }
    vzaCropUpdateBox(_vzaCropDrag.id);
    return;
  }

  if (_vzaNewStart) {
    const cx = Math.max(0, Math.min(100, px)), cy = Math.max(0, Math.min(100, py));
    const x = Math.min(_vzaNewStart.px, cx), y = Math.min(_vzaNewStart.py, cy);
    const w = Math.abs(cx - _vzaNewStart.px), h = Math.abs(cy - _vzaNewStart.py);
    let prev = document.getElementById('vza-new-preview');
    if (!prev) {
      prev = document.createElement('div'); prev.id = 'vza-new-preview';
      prev.style.cssText = 'position:absolute;border:2px dashed #6B6455;background:rgba(107,100,85,0.14);pointer-events:none;box-sizing:border-box;z-index:20;';
      wrap.appendChild(prev);
    }
    prev.style.left = x + '%'; prev.style.top = y + '%'; prev.style.width = w + '%'; prev.style.height = h + '%';
  }
}

function _vzaCropUp(e) {
  if (_vzaCropDrag) { _vzaCropDrag = null; vizScheduleSave(); return; }
  if (_vzaNewStart) {
    const wrap = document.getElementById('vza-crop-img-wrap');
    const rc = wrap.getBoundingClientRect();
    const px = Math.max(0, Math.min(100, (e.clientX - rc.left) / rc.width  * 100));
    const py = Math.max(0, Math.min(100, (e.clientY - rc.top)  / rc.height * 100));
    const x = Math.min(_vzaNewStart.px, px), y = Math.min(_vzaNewStart.py, py);
    const w = Math.abs(px - _vzaNewStart.px), h = Math.abs(py - _vzaNewStart.py);
    const prev = document.getElementById('vza-new-preview'); if (prev) prev.remove();
    if (w > 3 && h > 3) {
      vzaHistoryPush();
      const newId = 2000 + (_vzaNewBoxN++);
      vzaState.items.push({ id: newId, name: 'Custom Item', category: 'Other', qty: 1, description: '',
        region: { x, y, w, h }, colorIdx: vzaState.items.length, thumbSrc: null, added: false, skipped: false });
      vzaRenderCropBoxes();
      vzaCropSelect(newId);
      setTimeout(() => { const n = document.getElementById('vza-crop-sb-name'); if (n) { n.select(); n.focus(); } }, 20);
    }
    _vzaNewStart = null;
    vzaUpdateCropCount();
    vizScheduleSave();
  }
}

function _vzaCropKey(e) {
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
  if (e.ctrlKey && !e.shiftKey && e.key === 'z') { e.preventDefault(); vzaUndo(); }
  else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); vzaRedo(); }
  else if (e.key === 'Escape') { vzaCropDeselect(); }
  else if (e.key === 'Delete' && !typing) { vzaDeleteSelected(); }
  else if (e.key === 'Enter'  && !typing) { e.preventDefault(); vzaConfirmCrops(); }
}

function vzaUpdateCropCount() {
  const el = document.getElementById('vza-crop-count');
  const n  = vzaState.items.length;
  if (el) el.textContent = n + ' item' + (n !== 1 ? 's' : '');
}

function vzaConfirmCrops() {
  if (!vzaState.imgEl) return;
  vzaState.items.forEach(item => { item.thumbSrc = vzaCropRegion(item); });
  vzaState.addedCount = 0;

  vzaCropEditorCleanup();
  document.getElementById('vza-crop-editor-wrap').style.display = 'none';

  vzaRenderResults();

  const addAllBtn  = document.getElementById('vza-add-all-btn');
  const matchAllBtn= document.getElementById('vza-match-all-btn');
  if (addAllBtn)   addAllBtn.style.display = '';
  if (matchAllBtn) matchAllBtn.style.display = '';
  const status = document.getElementById('vza-status');
  if (status) status.textContent = vzaState.items.length + ' items — review and add to proposal';
  vizScheduleSave();
}

// ─────────────────────────────────────────────────────────────────────────────

// Fetches the crop library once per render pass rather than once per card —
// vzaBuildCard() runs in a tight forEach over potentially many detected
// items, and a network fetch per item would turn one render into N.
async function vzaRenderResults() {
  const grid = document.getElementById('vza-results-grid');
  if (!grid) return;
  const lib = await vzaLibGet();
  grid.innerHTML = '';
  vzaState.items.forEach(item => grid.appendChild(vzaBuildCard(item, lib)));
}

// Synchronous lookup against an already-fetched library map — see
// vzaRenderResults(). vzaLibCheck() below is the async, fetch-it-yourself
// version for any one-off caller that doesn't already have a map in hand.
function _vzaLibCheckSync(item, lib) {
  if (item.invSku && lib[item.invSku]) return lib[item.invSku];
  const nameKey = (item.name || '').toLowerCase().trim();
  return Object.values(lib).find(e => (e.name || '').toLowerCase().trim() === nameKey) || null;
}

function vzaBuildCard(item, lib) {
  const card = document.createElement('div');
  card.className = 'vza-item-card' + (item.added ? ' vza-done' : '');
  card.id = 'vza-card-' + item.id;

  // Thumbnail — prefer crop library photo if no local thumbSrc
  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'vza-thumb-wrap';
  const _libEntry = !item.thumbSrc ? _vzaLibCheckSync(item, lib) : null;
  const _thumbSrc = item.thumbSrc || (_libEntry && _libEntry.imgSrc) || null;
  if (_thumbSrc) {
    const img = document.createElement('img');
    img.className = 'vza-thumb-img'; img.src = _thumbSrc; img.alt = item.name;
    thumbWrap.appendChild(img);
    if (_libEntry) {
      const badge = document.createElement('div');
      badge.className = 'vza-from-lib-badge'; badge.textContent = 'From library';
      thumbWrap.appendChild(badge);
    }
  } else {
    const ph = document.createElement('div');
    ph.className = 'vza-thumb-ph'; ph.textContent = '🖼';
    thumbWrap.appendChild(ph);
  }
  card.appendChild(thumbWrap);

  const body = document.createElement('div');
  body.className = 'vza-card-body';

  // Editable name
  const nameIn = document.createElement('input');
  nameIn.type = 'text'; nameIn.className = 'vza-name-input';
  nameIn.value = item.name; nameIn.placeholder = 'Item name';
  nameIn.id = 'vza-name-' + item.id;
  body.appendChild(nameIn);

  // Category select
  const catSel = document.createElement('select');
  catSel.className = 'vza-cat-select'; catSel.id = 'vza-cat-' + item.id;
  INV_CATEGORIES.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    if (c.toLowerCase() === item.category.toLowerCase()) opt.selected = true;
    catSel.appendChild(opt);
  });
  if (!catSel.value) catSel.value = 'Other';
  body.appendChild(catSel);

  // Editable description
  const desc = document.createElement('textarea');
  desc.className = 'vza-desc-ta'; desc.id = 'vza-desc-' + item.id;
  desc.value = item.description; desc.rows = 3;
  desc.placeholder = 'Description…';
  body.appendChild(desc);

  // Price row
  const priceRow = document.createElement('div');
  priceRow.className = 'vza-price-row';
  const priceLabel = document.createElement('span');
  priceLabel.className = 'vza-price-label'; priceLabel.textContent = 'Price';
  const priceIn = document.createElement('input');
  priceIn.type = 'text'; priceIn.className = 'vza-price-input vza-price-empty';
  priceIn.id = 'vza-price-' + item.id; priceIn.placeholder = 'e.g. $150 or MP';
  priceIn.addEventListener('input', () => {
    const filled = priceIn.value.trim().length > 0;
    priceIn.classList.toggle('vza-price-empty', !filled);
    const hint = document.getElementById('vza-phint-' + item.id);
    if (hint) hint.classList.toggle('show', !filled);
  });
  priceRow.appendChild(priceLabel); priceRow.appendChild(priceIn);
  body.appendChild(priceRow);
  // No-price soft warning
  const priceHint = document.createElement('div');
  priceHint.className = 'vza-price-hint show'; priceHint.id = 'vza-phint-' + item.id;
  priceHint.textContent = 'No price set — you can add this in the proposal builder';
  body.appendChild(priceHint);

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'vza-actions';
  const addBtn = document.createElement('button');
  addBtn.className = 'vza-btn-primary'; addBtn.id = 'vza-add-btn-' + item.id;
  addBtn.textContent = 'Add to Proposal';
  addBtn.onclick = () => vzaAddItemToProposal(item.id);
  const skipBtn = document.createElement('button');
  skipBtn.className = 'vza-btn-skip'; skipBtn.id = 'vza-skip-btn-' + item.id;
  skipBtn.textContent = 'Skip';
  skipBtn.onclick = () => vzaSkip(item.id);
  actions.appendChild(addBtn); actions.appendChild(skipBtn);
  body.appendChild(actions);

  // Save to Library button (shown when thumbSrc exists)
  const libBtn = document.createElement('button');
  libBtn.className = 'vza-lib-save-btn'; libBtn.id = 'vza-lib-btn-' + item.id;
  const libEntry = _vzaLibCheckSync(item, lib);
  libBtn.textContent = libEntry ? '✓ In Crop Library' : '🗂 Save to Crop Library';
  if (libEntry) libBtn.classList.add('vza-lib-saved');
  libBtn.onclick = () => vzaLibSave(item.id);
  body.appendChild(libBtn);

  // Find in Inventory lazy button
  const findBtn = document.createElement('button');
  findBtn.className = 'vza-find-inv-btn'; findBtn.id = 'vza-find-btn-' + item.id;
  findBtn.textContent = 'Find in Inventory';
  findBtn.onclick = () => vzaFindInInventory(item.id);
  body.appendChild(findBtn);

  // Inventory dropdown (hidden initially)
  const invDrop = document.createElement('div');
  invDrop.className = 'vza-inv-dropdown'; invDrop.id = 'vza-inv-drop-' + item.id;
  invDrop.style.display = 'none';
  body.appendChild(invDrop);

  // Match info line (shown after applying a match)
  const matchInfo = document.createElement('div');
  matchInfo.className = 'vza-match-info'; matchInfo.id = 'vza-match-info-' + item.id;
  body.appendChild(matchInfo);

  card.appendChild(body);
  return card;
}

function vzaAddItemToProposal(id) {
  const item = vzaState.items.find(i => i.id === id);
  if (!item || item.added) return;
  const nameEl  = document.getElementById('vza-name-' + id);
  const catEl   = document.getElementById('vza-cat-' + id);
  const descEl  = document.getElementById('vza-desc-' + id);
  const priceEl = document.getElementById('vza-price-' + id);
  const name  = (nameEl  ? nameEl.value.trim()  : '') || item.name;
  const cat   = (catEl   ? catEl.value          : item.category) || 'Other';
  const notes = (descEl  ? descEl.value.trim()  : '') || item.description;
  const rawPrice = priceEl ? priceEl.value.trim() : '';
  const rawN = parseFloat((rawPrice || '').replace(/[^0-9.]/g, ''));
  const normPrice = (!isNaN(rawN) && rawN > 0) ? '$' + rawN.toFixed(2) : (rawPrice || 'MP');
  propItemIdCounter++;
  proposalItems.push({
    id: propItemIdCounter, name, cat, price: normPrice,
    sku: item.invSku || ('VIS-' + propItemIdCounter), qty: Math.max(1, item.qty || 1),
    notes, area: '', imgSrc: item.thumbSrc || '',
    isCustom: true, isVenueItem: false
  });
  const addedId = propItemIdCounter; // capture ID of the item just pushed
  propRender();
  _vzaMarkAdded(id);
  if (typeof _vizSplitFlash === 'function') _vizSplitFlash(addedId);
  showToast('✓ Added: ' + name, 'toast-success');
  vizScheduleSave();
}

function vzaSkip(id) {
  const item = vzaState.items.find(i => i.id === id);
  if (item) { item.skipped = true; item.added = true; }
  const card = document.getElementById('vza-card-' + id);
  if (card) card.classList.add('vza-done');
  _vzaMarkAdded(id);
  vizScheduleSave();
}

function vzaAddAll() {
  const pending = vzaState.items.filter(i => !i.added && !i.skipped);
  if (!pending.length) return;
  pending.forEach(item => vzaAddItemToProposal(item.id));
  showToast('✓ Added ' + pending.length + ' item' + (pending.length > 1 ? 's' : '') + ' to proposal', 'toast-success');
}

function vzaMatchAll() {
  vzaState.items.forEach(item => {
    if (item.added || item.skipped) return;
    const nameEl = document.getElementById('vza-name-' + item.id);
    const catEl  = document.getElementById('vza-cat-' + item.id);
    const name = nameEl ? nameEl.value.trim() : item.name;
    const cat  = catEl  ? catEl.value         : item.category;
    const top = vzaTopMatches(name, cat, 1);
    if (top.length && top[0].score >= 30) vzaApplyInventoryMatch(item.id, top[0]);
  });
  showToast('Inventory matches applied where found', 'toast-info');
}

function vzaFindInInventory(id) {
  const item = vzaState.items.find(i => i.id === id);
  if (!item) return;
  const nameEl = document.getElementById('vza-name-' + id);
  const catEl  = document.getElementById('vza-cat-' + id);
  const name = nameEl ? nameEl.value.trim() : item.name;
  const cat  = catEl  ? catEl.value         : item.category;
  const matches = vzaTopMatches(name, cat, 5);
  const drop = document.getElementById('vza-inv-drop-' + id);
  if (!drop) return;
  drop.innerHTML = '';
  if (!matches.length) {
    drop.innerHTML = '<div style="padding:8px 11px;font-size:var(--fs-xs);color:var(--text-3);">No inventory matches found.</div>';
    drop.style.display = '';
    return;
  }
  matches.forEach(m => {
    const opt = document.createElement('div');
    opt.className = 'vza-inv-option';
    const namePart  = document.createElement('span'); namePart.className = 'vza-inv-option-name'; namePart.textContent = m.name;
    const pricePart = document.createElement('span'); pricePart.className = 'vza-inv-option-price'; pricePart.textContent = m.price && m.price !== 'MP' ? m.price : 'MP';
    opt.appendChild(namePart); opt.appendChild(pricePart);
    opt.onclick = () => { vzaApplyInventoryMatch(id, m); drop.style.display = 'none'; };
    drop.appendChild(opt);
  });
  drop.style.display = '';
}

function vzaTopMatches(name, cat, n) {
  const norm = s => (s || '').toLowerCase().trim();
  const toks = s => norm(s).split(/\s+/).filter(t => t.length > 2);
  const nameN = norm(name); const nameT = toks(name); const catN = norm(cat);
  const cards = Array.from(document.querySelectorAll('#inv-grid .inv-card'));
  const scored = cards.map(card => {
    const cn = card.dataset.name || ''; const cc = card.dataset.cat || '';
    let score = 0;
    if (norm(cc) === catN) score += 35;
    else if (norm(cc).includes(catN) || catN.includes(norm(cc))) score += 18;
    const ct = toks(cn);
    nameT.forEach(t => { if (ct.includes(t)) score += 14; });
    if (norm(cn).includes(nameN) || nameN.includes(norm(cn))) score += 22;
    return { score, name: card.dataset.name || '', price: card.dataset.price || '', sku: card.dataset.sku || '', cat: card.dataset.cat || '', imgSrc: ((card.querySelector('.inv-img img') || {}).src || '') };
  }).filter(m => m.score >= 22).sort((a, b) => b.score - a.score);
  return scored.slice(0, n);
}

function vzaApplyInventoryMatch(id, match) {
  const item = vzaState.items.find(i => i.id === id);
  if (!item) return;
  item.invSku = match.sku;
  const nameEl  = document.getElementById('vza-name-'  + id);
  const catEl   = document.getElementById('vza-cat-'   + id);
  const priceEl = document.getElementById('vza-price-' + id);
  if (nameEl  && match.name)  nameEl.value  = match.name;
  if (catEl   && match.cat)   catEl.value   = match.cat;
  if (priceEl && match.price && match.price !== 'MP') priceEl.value = match.price;
  if (match.imgSrc) item.thumbSrc = match.imgSrc;
  const info = document.getElementById('vza-match-info-' + id);
  if (info) { info.textContent = 'Matched: ' + match.name; info.style.display = ''; }
  const drop = document.getElementById('vza-inv-drop-' + id);
  if (drop) drop.style.display = 'none';
}

function _vzaMarkAdded(id) {
  const item = vzaState.items.find(i => i.id === id);
  if (item && !item.skipped) item.added = true;
  const card = document.getElementById('vza-card-' + id);
  if (card) card.classList.add('vza-done');
  vzaState.addedCount = vzaState.items.filter(i => i.added && !i.skipped).length;
  const countEl = document.getElementById('vza-added-count');
  if (countEl) {
    const remaining = vzaState.items.filter(i => !i.added && !i.skipped).length;
    countEl.textContent = vzaState.addedCount + ' added' + (remaining > 0 ? ' · ' + remaining + ' remaining' : '');
  }
}
