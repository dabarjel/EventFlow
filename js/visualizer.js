// Venue Visualizer: state persistence, stages, AI generation, annotation, export.

// ══════════════════════════════════════════════════════════════════════════════
// ── VENUE VISUALIZER ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let vizState = {
  venueBase64:    null,
  venueMime:      'image/jpeg',
  currentImageSrc: null,   // URL or data-URL of current mockup
  currentClaudeDesc: null, // last Claude description used
  versions:       [],      // [{src, thumb, desc}]
  callouts:       [],      // [{id,nx,ny,label,price,sku,color}]
  draggingId:     null,
  dragOffNx:      0,
  dragOffNy:      0,
  fromProposal:   false,
};
let _vizCalloutIdSeq = 0;

// ── Visualizer State Persistence ─────────────────────────────────────────────
const VIZ_PERSIST_KEY = 'vizState_v1';
let _vizSaveTimer = null;
let _vizSavedFlashTimer = null;

function vizScheduleSave() {
  clearTimeout(_vizSaveTimer);
  _vizSaveTimer = setTimeout(_vizDoSave, 600);
}

function _vizDoSave() {
  const stage = (['entry','input','generating','review','annotate','analyze']
    .find(s => { const el = document.getElementById('viz-stage-' + s); return el && el.classList.contains('active'); }) || 'entry');
  const cropEditorVisible = (document.getElementById('vza-crop-editor-wrap') || {}).style.display !== 'none';

  const data = {
    stage,
    venueBase64:      vizState.venueBase64,
    venueMime:        vizState.venueMime,
    currentClaudeDesc: vizState.currentClaudeDesc,
    versions:         vizState.versions.map(v => ({ thumb: v.thumb, desc: v.desc })),
    callouts:         vizState.callouts,
    fromProposal:     vizState.fromProposal,
    vzaImgSrc:        vzaState.imgSrc,
    vzaItems:         vzaState.items.map(i => ({ id:i.id, name:i.name, category:i.category, qty:i.qty, description:i.description, region:i.region, colorIdx:i.colorIdx, added:i.added, skipped:i.skipped })),
    vzaAddedCount:    vzaState.addedCount,
    cropEditorVisible,
    cropMode:         _vzaCropMode
  };

  // Save with images; fall back to without if quota exceeded
  const full = Object.assign({}, data, { currentImageSrc: vizState.currentImageSrc,
    vzaItemThumbs: vzaState.items.reduce((acc, i) => { acc[i.id] = i.thumbSrc || null; return acc; }, {}) });
  let saved = false;
  try {
    localStorage.setItem(VIZ_PERSIST_KEY, JSON.stringify(full));
    saved = true;
  } catch(e) {
    try {
      localStorage.setItem(VIZ_PERSIST_KEY, JSON.stringify(data));
      saved = true;
    } catch(e2) {
      saved = false;
    }
  }

  if (saved) {
    _vizFlashSaved();
  } else if (typeof showToast === 'function') {
    showToast('Storage full — could not save your Venue Visualizer progress. Delete an old proposal or session to free up space.', 'toast-error');
  }
}

function _vizFlashSaved() {
  const el = document.getElementById('viz-saved-indicator');
  if (!el) return;
  el.textContent = '✓ Saved';
  el.style.opacity = '1';
  clearTimeout(_vizSavedFlashTimer);
  _vizSavedFlashTimer = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function vizRestoreState() {
  try {
    const raw = localStorage.getItem(VIZ_PERSIST_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d) return false;

    // Restore vizState
    vizState.venueBase64      = d.venueBase64      || null;
    vizState.venueMime        = d.venueMime        || 'image/jpeg';
    vizState.currentImageSrc  = d.currentImageSrc  || null;
    vizState.currentClaudeDesc= d.currentClaudeDesc|| null;
    vizState.versions         = (d.versions || []).map(v => ({ thumb: v.thumb, desc: v.desc, src: null }));
    vizState.callouts         = d.callouts         || [];
    vizState.fromProposal     = d.fromProposal     || false;

    // Restore vzaState (no imgEl — will be recreated)
    vzaState.imgSrc     = d.vzaImgSrc    || null;
    vzaState.addedCount = d.vzaAddedCount || 0;
    const thumbs = d.vzaItemThumbs || {};
    vzaState.items = (d.vzaItems || []).map(i => Object.assign({}, i, { thumbSrc: thumbs[i.id] || null, imgEl: null }));

    // Recreate imgEl if we have imgSrc
    if (vzaState.imgSrc) {
      vzaState.imgEl = new Image();
      vzaState.imgEl.src = vzaState.imgSrc;
    }

    const stage = d.stage || 'entry';

    // Restore venue photo thumbnail (input stage)
    if (vizState.venueBase64) {
      const thumb = document.getElementById('viz-venue-thumb');
      const ph    = document.getElementById('viz-upload-placeholder');
      if (thumb) { thumb.src = 'data:' + vizState.venueMime + ';base64,' + vizState.venueBase64; thumb.style.display = ''; }
      if (ph)    ph.style.display = 'none';
    }

    // Restore analyze photo thumbnail
    if (vzaState.imgSrc) {
      const vzaThumb = document.getElementById('vza-thumb');
      const vzaPh    = document.getElementById('vza-upload-ph');
      const vzaBtn   = document.getElementById('vza-analyze-btn');
      if (vzaThumb) { vzaThumb.src = vzaState.imgSrc; vzaThumb.style.display = 'block'; }
      if (vzaPh)    vzaPh.style.display = 'none';
      if (vzaBtn)   vzaBtn.disabled = false;
    }

    vizShowStage(stage);

    if (stage === 'review' && vizState.currentImageSrc) {
      const reviewImg = document.getElementById('viz-review-img');
      if (reviewImg) reviewImg.src = vizState.currentImageSrc;
      vizRenderVersionStrip();
    } else if (stage === 'annotate' && vizState.currentImageSrc) {
      const annImg = document.getElementById('viz-annotate-img');
      if (annImg) { annImg.src = vizState.currentImageSrc; annImg.onload = () => vizRenderCallouts(); }
      vizSetupAnnotationEvents();
      vizRenderCalloutList();
    } else if (stage === 'analyze') {
      if (vzaState.imgSrc) {
        const status = document.getElementById('vza-status');
        if (d.cropEditorVisible && vzaState.items.length) {
          // Restore crop editor (vzaShowCropEditor defaults to draw; re-apply saved mode after)
          vzaShowCropEditor();
          vzaSetMode(d.cropMode || 'draw');
          if (status) status.textContent = vzaState.items.length + ' items — adjust crops then confirm';
        } else if (vzaState.items.length && vzaState.items.some(i => i.thumbSrc)) {
          // Results were confirmed — show result cards
          vzaRenderResults();
          const addAllBtn   = document.getElementById('vza-add-all-btn');
          const matchAllBtn = document.getElementById('vza-match-all-btn');
          if (addAllBtn)   addAllBtn.style.display = '';
          if (matchAllBtn) matchAllBtn.style.display = '';
          if (status) status.textContent = vzaState.items.length + ' items — review and add to proposal';
          const countEl = document.getElementById('vza-added-count');
          if (countEl && vzaState.addedCount) countEl.textContent = vzaState.addedCount + ' added to proposal';
        } else if (status) {
          status.textContent = vzaState.imgSrc ? 'Photo loaded — click Identify Items.' : 'Upload a photo to begin.';
        }
      }
    }

    vizUpdateGenerateBtn();
    vizUpdateProposalChips();
    return true;
  } catch(e) {
    console.warn('[VIZ] State restore failed:', e);
    return false;
  }
}

// ── Init & navigation ─────────────────────────────────────────────────────────

function vizInit() {
  // Restore persisted state; only show entry if nothing was saved
  if (!vizRestoreState()) vizShowStage('entry');
  vizUpdateGenerateBtn();
  vizUpdateProposalChips();
}

function vizShowStage(stage) {
  ['entry','input','generating','review','annotate','analyze'].forEach(s => {
    const el = document.getElementById('viz-stage-' + s);
    if (el) { el.classList.toggle('active', s === stage); }
  });
  const stages = {entry:'', input:'Generate Mockup', generating:'Generating…', review:'Review & Refine', annotate:'Annotate', analyze:'Analyze Photo'};
  const ind = document.getElementById('viz-stage-indicator');
  const label = stages[stage];
  if (ind) ind.textContent = label ? '— ' + label : '';
  if (stage !== 'generating') vizScheduleSave();
}

function vizGoToEntry()    { vizShowStage('entry'); }
function vizGoToInput()    { vizShowStage('input'); }
function vizGoToReview()   { vizShowStage('review'); }
function vizGoToAnnotate() {
  vizShowStage('annotate');
  const img = document.getElementById('viz-annotate-img');
  if (img && vizState.currentImageSrc) {
    img.src = vizState.currentImageSrc;
    img.onload = () => vizRenderCallouts();
  }
  vizSetupAnnotationEvents();
  vizRenderCalloutList();
}

function vizReset() {
  if (vizState.versions.length && !confirm('Reset the Venue Visualizer? This will clear all generated mockups and annotations.')) return;
  localStorage.removeItem(VIZ_PERSIST_KEY);
  vizState = { venueBase64:null, venueMime:'image/jpeg', currentImageSrc:null, currentClaudeDesc:null, versions:[], callouts:[], draggingId:null, dragOffNx:0, dragOffNy:0, fromProposal:false };
  _vizCalloutIdSeq = 0;
  const thumb = document.getElementById('viz-venue-thumb');
  const placeholder = document.getElementById('viz-upload-placeholder');
  if (thumb) { thumb.style.display = 'none'; thumb.src = ''; }
  if (placeholder) placeholder.style.display = '';
  const venueDesc = document.getElementById('viz-venue-desc');
  const designInput = document.getElementById('viz-design-input');
  if (venueDesc) venueDesc.value = '';
  if (designInput) designInput.value = '';
  vizShowStage('entry');
  vizUpdateGenerateBtn();
}

function vizOpenFromProposal() {
  navigate('visualizer');
  vizState.fromProposal = true;
  vizUpdateProposalChips();
  // Pre-populate description with proposal items
  const desc = document.getElementById('viz-design-input');
  if (desc && proposalItems.length) {
    const existing = desc.value.trim();
    const items = proposalItems.map(i => `${i.qty > 1 ? i.qty + '× ' : ''}${i.name}`).join(', ');
    if (!existing) desc.value = 'Set up the event space with: ' + items;
  }
  vizUpdateGenerateBtn();
}

function vizUpdateProposalChips() {
  const container = document.getElementById('viz-proposal-chips');
  if (!container) return;
  if (!proposalItems || !proposalItems.length) {
    container.innerHTML = '<span style="font-size:var(--fs-2xs);color:var(--text-3);font-style:italic;">No proposal items yet — build a proposal first.</span>';
    return;
  }
  // Chip label goes into a data-attribute (read back via .dataset, which the
  // browser HTML-decodes correctly) rather than an inline onclick JS-string
  // literal — interpolating user text into onclick="fn(this,'...')" needs
  // both JS-string escaping AND HTML-attribute escaping applied in the right
  // order, and getting that wrong is an easy way to reopen an XSS hole.
  container.innerHTML = proposalItems.map(item => {
    const label = (item.qty > 1 ? item.qty + '× ' : '') + item.name;
    return `<span class="viz-item-chip" title="Click to add to description" data-label="${escapeHtml(label)}">${escapeHtml(label)}</span>`;
  }).join('');
  container.querySelectorAll('.viz-item-chip').forEach(chip => {
    chip.onclick = () => vizAddChipToDesc(chip, chip.dataset.label);
  });
}

function vizAddChipToDesc(chip, label) {
  chip.classList.toggle('active');
  const desc = document.getElementById('viz-design-input');
  if (!desc) return;
  if (chip.classList.contains('active')) {
    desc.value = (desc.value.trim() ? desc.value.trim() + ', ' : '') + label;
  } else {
desc.value = desc.value.replace(new RegExp('(?:,\s*)?' + label.replace(/[.*+?^${}()|[\]\\]/g, function(m){ return '\\' + m; }) + '(?:\s*,)?', ''), '').trim().replace(/^,|,$/, '').trim();
  }
  vizUpdateGenerateBtn();
}

function vizUpdateGenerateBtn() {
  const btn  = document.getElementById('viz-generate-btn');
  const hasDesc  = !!(document.getElementById('viz-design-input') || {value:''}).value.trim()
                || !!(document.getElementById('viz-venue-desc')   || {value:''}).value.trim();
  const hasVenue = !!(vizState.venueBase64) || !!(document.getElementById('viz-venue-desc')||{value:''}).value.trim();

  if (!btn) return;
  const canGen = hasDesc && (hasVenue || hasDesc);
  btn.disabled = !canGen;
}

// ── Venue upload ──────────────────────────────────────────────────────────────

function vizHandleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  resizeImageFile(file, 800, 0.8).then(dataUrl => {
    vizState.venueMime = 'image/jpeg'; // re-encoded as JPEG regardless of source format
    vizState.venueBase64 = dataUrl.split(',')[1];
    const thumb = document.getElementById('viz-venue-thumb');
    const placeholder = document.getElementById('viz-upload-placeholder');
    if (thumb) { thumb.src = dataUrl; thumb.style.display = 'block'; }
    if (placeholder) placeholder.style.display = 'none';
    vizUpdateGenerateBtn();
  }).catch(() => {
    if (typeof showToast === 'function') showToast('Could not process that image — try a different file', 'toast-error');
  });
}

function vizHandleDrop(e) {
  e.preventDefault();
  document.getElementById('viz-upload-zone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) vizHandleFile(file);
}

// ── Generate ──────────────────────────────────────────────────────────────────

async function vizGenerate() {
  const designDesc  = (document.getElementById('viz-design-input')  || {value:''}).value.trim();
  const venueDesc   = (document.getElementById('viz-venue-desc')    || {value:''}).value.trim();
  const fullContext = (venueDesc ? 'Venue: ' + venueDesc + '. ' : '') + 'Setup: ' + designDesc;

  vizShowStage('generating');
  const subEl   = document.getElementById('viz-progress-sub');
  const titleEl = document.getElementById('viz-progress-title');

  try {
    let claudeDesc = null;

    if (vizState.venueBase64) {
      if (titleEl) titleEl.textContent = 'Analyzing your venue…';
      if (subEl)   subEl.textContent   = 'Claude is studying the space and composing the design description…';
      claudeDesc = await vizCallClaude(vizState.venueBase64, vizState.venueMime, fullContext);
    } else {
      claudeDesc = 'Professional event photography of ' + fullContext + '. Photorealistic, elegant interior event design, high-end lighting.';
    }

    vizState.currentClaudeDesc = claudeDesc;

    if (titleEl) titleEl.textContent = 'Generating image with DALL-E 3…';
    if (subEl)   subEl.textContent   = 'This takes 15–30 seconds. Almost there…';
    const imageUrl = await vizCallDALLE3(claudeDesc);
    await vizDisplayResult(imageUrl, claudeDesc);
  } catch(err) {
    vizShowStage('input');
    showToast('Error: ' + (err.message || err), 'toast-error');
    console.error('[Visualizer]', err);
  }
}

async function vizRefine() {
  const refineText = (document.getElementById('viz-refine-input') || {value:''}).value.trim();
  if (!refineText) { showToast('Describe what to change first', 'toast-info'); return; }
  const existing = (document.getElementById('viz-design-input') || {value:''}).value;
  const combined = (existing || '') + '. Refinement: ' + refineText;

  // Store refine instruction as design desc for next round
  const di = document.getElementById('viz-design-input');
  if (di) di.value = combined;
  await vizGenerate();
}

// ── API Calls ─────────────────────────────────────────────────────────────────
// All Anthropic/OpenAI calls go through the ai-proxy Edge Function, which holds
// the real API keys server-side and only forwards requests for a signed-in staff
// session — no key ever reaches the browser.

async function _vizAiProxy(provider, payload) {
  const { data, error } = await sb.functions.invoke('ai-proxy', { body: { provider, payload } });
  if (error) {
    let msg = error.message || 'AI request failed';
    if (error.context && typeof error.context.json === 'function') {
      try {
        const errBody = await error.context.json();
        if (errBody && errBody.error) msg = errBody.error.message || errBody.error;
      } catch (e) {}
    }
    throw new Error(msg);
  }
  return data;
}

async function vizCallClaude(imgB64, mime, description) {
  const data = await _vizAiProxy('anthropic', {
    model: 'claude-opus-4-6',
    max_tokens: 800,
    messages: [{
      role: 'user',
      content: [
        { type:'image', source:{ type:'base64', media_type:mime, data:imgB64 } },
        { type:'text', text:
          'You are an expert event designer and photographer. Study this venue photo carefully.\n\n'
        + 'The client wants this setup: "' + description + '"\n\n'
        + 'Write a photorealistic DALL-E 3 image generation prompt that shows this exact venue with the requested event setup. '
        + 'Your prompt must:\n'
        + '1. Describe the venue\'s architecture precisely (ceiling height, windows, floor, walls, lighting fixtures)\n'
        + '2. Place the requested furniture and décor in realistic positions that match the room layout\n'
        + '3. Describe lighting, atmosphere, and perspective as if this is professional event photography\n'
        + '4. Be vivid and specific — mention colors, materials, quantities\n\n'
        + 'Return ONLY the DALL-E prompt. Start with: "Professional event photography of"'
        }
      ]
    }]
  });
  return data.content && data.content[0] ? data.content[0].text.trim() : '';
}

async function vizCallDALLE3(imgPrompt) {
  const data = await _vizAiProxy('openai', {
    model: "gpt-image-1",
    prompt: imgPrompt,
    n: 1,
    size: "1024x1024"
  });
  return "data:image/png;base64," + data.data[0].b64_json;
}

// ── Display results ───────────────────────────────────────────────────────────

async function vizDisplayResult(imageUrlOrDataUrl, claudeDesc) {
  // Try to cache image as base64 (so it persists and exports work cross-origin)
  let finalSrc = imageUrlOrDataUrl;
  if (imageUrlOrDataUrl.startsWith('http')) {
    try {
      const r = await fetch(imageUrlOrDataUrl);
      const blob = await r.blob();
      finalSrc = await new Promise(res => { const fr = new FileReader(); fr.onload = e => res(e.target.result); fr.readAsDataURL(blob); });
    } catch(e) {
      finalSrc = imageUrlOrDataUrl; // fallback to URL if CORS blocks
    }
  }

  // Re-encode as JPEG at close to native resolution. This is the hero image
  // in the client-facing proposal document, so it gets a lighter touch than
  // the 800px/0.8 treatment used for reference photo uploads — maxDim 1200 is
  // a no-op for DALL-E's standard 1024x1024 output, and quality 0.90 matches
  // the crop-thumbnail precedent (vzaCropRegion). PNG→JPEG re-encoding alone
  // typically cuts a DALL-E result 70-90% with no visible quality loss.
  try {
    const srcBlob = await (await fetch(finalSrc)).blob();
    finalSrc = await resizeImageFile(srcBlob, 1200, 0.90);
  } catch (e) {
    // Keep the uncompressed finalSrc if re-encoding fails for any reason
    // (e.g. finalSrc is still a bare http URL because the fetch above was
    // CORS-blocked) — a working uncompressed image beats none at all.
  }

  vizState.currentImageSrc = finalSrc;
  vizState.versions.push({ src: finalSrc, desc: claudeDesc });

  const revImg = document.getElementById('viz-review-img');
  if (revImg) revImg.src = finalSrc;

  // Version thumbnails
  vizRenderVersionStrip();

  // Show Claude's prompt
  const pc = document.getElementById('viz-dalle-prompt-card');
  const pt = document.getElementById('viz-dalle-prompt-text');
  if (pc && claudeDesc) { pc.style.display = ''; if (pt) pt.textContent = claudeDesc; }

  vizShowStage('review');
  showToast('✓ Mockup generated!', 'toast-success');
}

function vizRenderVersionStrip() {
  const strip = document.getElementById('viz-version-strip');
  if (!strip) return;
  strip.innerHTML = vizState.versions.map((v, i) => {
    const isActive = i === vizState.versions.length - 1;
    if (!v.src) return '';
    return `<img src="${v.src}" class="viz-version-thumb ${isActive ? 'active' : ''}" title="Version ${i+1}" onclick="vizSelectVersion(${i})" style="width:72px;height:52px;object-fit:cover;cursor:pointer;">`;
  }).join('');
}

function vizSelectVersion(idx) {
  const v = vizState.versions[idx];
  if (!v || !v.src) return;
  vizState.currentImageSrc = v.src;
  const revImg = document.getElementById('viz-review-img');
  if (revImg) revImg.src = v.src;
  document.querySelectorAll('.viz-version-thumb').forEach((el, i) => el.classList.toggle('active', i === idx));
}

// ── Annotation tool ───────────────────────────────────────────────────────────

const VIZ_CALLOUT_COLORS = ['#8B6A72','#1E40AF','#065F46','#B8955A','#5B21B6','#92400E'];

function vizSetupAnnotationEvents() {
  const svg = document.getElementById('viz-callout-svg');
  if (!svg || svg._vizBound) return;
  svg._vizBound = true;

  svg.addEventListener('click', e => {
    // If clicking on a callout control, don't create new
    if (e.target.closest('[data-viz-ctrl]')) return;

    const rect = svg.getBoundingClientRect();
    const nx = (e.clientX - rect.left)  / rect.width;
    const ny = (e.clientY - rect.top)   / rect.height;

    // Show a quick input dialog
    const label = prompt('Callout label (e.g. "Navy Blue Draping"):');
    if (!label) return;
    const price = prompt('Price (optional, e.g. $450):', '') || '';

    const color = VIZ_CALLOUT_COLORS[vizState.callouts.length % VIZ_CALLOUT_COLORS.length];
    vizState.callouts.push({ id: ++_vizCalloutIdSeq, nx, ny, label: label.trim(), price: price.trim(), sku: '', color });

    vizRenderCallouts();
    vizRenderCalloutList();
  });

  // Drag support
  svg.addEventListener('mousedown', e => {
    const circle = e.target.closest('[data-viz-drag]');
    if (!circle) return;
    vizState.draggingId = parseInt(circle.dataset.vizDrag);
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!vizState.draggingId) return;
    const svg = document.getElementById('viz-callout-svg');
    const rect = svg.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top)  / rect.height));
    const c = vizState.callouts.find(x => x.id === vizState.draggingId);
    if (c) { c.nx = nx; c.ny = ny; vizRenderCallouts(); }
  });
  window.addEventListener('mouseup', () => { vizState.draggingId = null; });
}

function vizRenderCallouts() {
  const svg = document.getElementById('viz-callout-svg');
  if (!svg) return;
  const W = svg.clientWidth  || 800;
  const H = svg.clientHeight || 450;

  svg.innerHTML = vizState.callouts.map(c => {
    const cx = c.nx * W;
    const cy = c.ny * H;
    // Label box placement: offset to avoid clipping edges
    let lx = cx + 16, ly = cy - 14;
    if (lx + 140 > W) lx = cx - 156;
    if (ly < 0)       ly = cy + 14;

    const labelText = c.label + (c.price ? '  ' + c.price : '');
    const boxW   = Math.min(Math.max(labelText.length * 7 + 22, 100), 200);
    const priceX = lx + boxW - 8;
    const delCX  = lx + boxW + 9;
    const escapedLabel = escapeHtml(c.label);
    const escapedPrice = escapeHtml(c.price);
    const priceEl = c.price
      ? '<text x="' + priceX + '" y="' + (ly + 17) + '" fill="' + c.color + '" font-size="11" font-family="Inter,sans-serif" font-weight="700" text-anchor="end">' + escapedPrice + '</text>'
      : '';

    return '<g data-id="' + c.id + '">'
      + '<line x1="' + cx + '" y1="' + cy + '" x2="' + lx + '" y2="' + (ly + 12) + '" stroke="' + c.color + '" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.9"/>'
      + '<circle cx="' + cx + '" cy="' + cy + '" r="7" fill="' + c.color + '" stroke="#fff" stroke-width="2" cursor="move" data-viz-drag="' + c.id + '" style="cursor:move;"/>'
      + '<rect x="' + lx + '" y="' + ly + '" width="' + boxW + '" height="26" rx="5" fill="rgba(28,25,23,0.88)" stroke="' + c.color + '" stroke-width="1"/>'
      + '<text x="' + (lx + 9) + '" y="' + (ly + 17) + '" fill="white" font-size="11" font-family="Inter,sans-serif" font-weight="600">' + escapedLabel + '</text>'
      + priceEl
      + '<circle cx="' + delCX + '" cy="' + (ly + 13) + '" r="8" fill="#B3261E" opacity="0.9" data-viz-ctrl="1" style="cursor:pointer;" onclick="vizDeleteCallout(' + c.id + ')"/>'
      + '<text x="' + delCX + '" y="' + (ly + 17) + '" fill="white" font-size="11" text-anchor="middle" font-family="sans-serif" pointer-events="none">×</text>'
      + '</g>';
  }).join('');
}

function vizDeleteCallout(id) {
  vizState.callouts = vizState.callouts.filter(c => c.id !== id);
  vizRenderCallouts();
  vizRenderCalloutList();
}

function vizRenderCalloutList() {
  const list = document.getElementById('viz-callout-list');
  if (!list) return;
  if (!vizState.callouts.length) {
    list.innerHTML = '<div style="font-size:var(--fs-xs);color:var(--text-3);font-style:italic;padding:8px 0;">Click the mockup to add callout markers.</div>';
    return;
  }
  const invItems = [...document.querySelectorAll('#inv-grid .inv-card')].map(c => ({
    sku: c.dataset.sku, name: c.dataset.name, price: c.dataset.price
  }));
  list.innerHTML = vizState.callouts.map(c => {
    const invOptions = invItems.slice(0,60).map(inv =>
      `<option value="${escapeHtml(inv.sku)}" ${inv.sku === c.sku ? 'selected' : ''}>${escapeHtml(inv.name)}</option>`
    ).join('');
    return `<div class="viz-callout-row" id="viz-cr-${c.id}">
      <div>
        <div class="viz-callout-label">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c.color};margin-right:5px;vertical-align:middle;"></span>
          <input type="text" value="${escapeHtml(c.label)}" style="border:none;background:transparent;font-size:var(--fs-xs);font-weight:var(--weight-medium);font-family:var(--font-sans);outline:none;color:var(--text);width:100%;" onchange="vizUpdateCallout(${c.id},'label',this.value)">
        </div>
        <select style="font-size:var(--fs-2xs);color:var(--text-3);border:none;background:transparent;margin-top:2px;font-family:var(--font-sans);outline:none;max-width:170px;" onchange="vizLinkInventory(${c.id},this.value)">
          <option value="">— link inventory item —</option>${invOptions}
        </select>
      </div>
      <input type="text" value="${escapeHtml(c.price)}" placeholder="$" style="width:56px;padding:3px 6px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-size:var(--fs-xs);font-family:var(--font-sans);text-align:right;outline:none;" onchange="vizUpdateCallout(${c.id},'price',this.value)">
      <button onclick="vizRenderCallouts()" style="padding:3px 7px;border:1px solid var(--accent-text);border-radius:var(--radius-sm);background:var(--surface-active);color:var(--text);cursor:pointer;font-size:var(--fs-xs);" title="Refresh preview">↺</button>
      <button onclick="vizDeleteCallout(${c.id})" style="padding:3px 7px;border:1px solid #B3261E;border-radius:var(--radius-sm);background:var(--surface);color:var(--danger-text);cursor:pointer;font-size:var(--fs-xs);" title="Remove">✕</button>
    </div>`;
  }).join('');
}

function vizUpdateCallout(id, field, value) {
  const c = vizState.callouts.find(x => x.id === id);
  if (c) c[field] = value;
}

function vizLinkInventory(id, sku) {
  const c = vizState.callouts.find(x => x.id === id);
  if (!c || !sku) return;
  const card = document.querySelector(`#inv-grid .inv-card[data-sku="${sku}"]`);
  if (!card) return;
  c.sku   = sku;
  c.label = card.dataset.name || c.label;
  const p = card.dataset.price;
  if (p && p !== 'MP') c.price = p;
  vizRenderCalloutList();
  vizRenderCallouts();
}

// ── Export & Proposal integration ─────────────────────────────────────────────

async function vizExportPNG() {
  if (!vizState.currentImageSrc) return null;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = vizState.currentImageSrc;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });

  const canvas = document.createElement('canvas');
  canvas.width  = img.naturalWidth  || 1792;
  canvas.height = img.naturalHeight || 1024;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);

  // Draw callouts scaled to natural image size
  const W = canvas.width, H = canvas.height;
  ctx.save();
  vizState.callouts.forEach(c => {
    const cx = c.nx * W, cy = c.ny * H;
    const lx = cx + (cx + 160 > W ? -170 : 18);
    const ly = cy + (cy < 30 ? 16 : -16);
    const labelText = c.label + (c.price ? '  ' + c.price : '');
    const boxW = Math.max(labelText.length * 8 + 24, 110);

    // Leader line
    ctx.strokeStyle = c.color; ctx.lineWidth = 2; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly + 14); ctx.stroke();
    ctx.setLineDash([]);

    // Circle
    ctx.fillStyle = c.color;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke();

    // Label box
    ctx.fillStyle = 'rgba(28,25,23,0.88)';
    ctx.beginPath(); ctx.roundRect(lx, ly, boxW, 30, 5); ctx.fill();
    ctx.strokeStyle = c.color; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(lx, ly, boxW, 30, 5); ctx.stroke();

    // Label text
    ctx.fillStyle = '#fff';
    ctx.font = '600 13px "Inter", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.label, lx + 10, ly + 15);
    if (c.price) {
      ctx.fillStyle = c.color;
      ctx.textAlign = 'right';
      ctx.fillText(c.price, lx + boxW - 8, ly + 15);
      ctx.textAlign = 'left';
    }
  });
  ctx.restore();

  return canvas.toDataURL('image/png');
}

async function vizCropCalloutThumb(c) {
  if (!vizState.currentImageSrc) return '';
  const img = new Image();
  img.src = vizState.currentImageSrc;
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
  const IW = img.naturalWidth  || 1024;
  const IH = img.naturalHeight || 1024;
  const radius = Math.round(Math.min(IW, IH) * 0.2);
  const cx = Math.round(c.nx * IW);
  const cy = Math.round(c.ny * IH);
  const sx = Math.max(0, cx - radius);
  const sy = Math.max(0, cy - radius);
  const sw = Math.min(radius * 2, IW - sx);
  const sh = Math.min(radius * 2, IH - sy);
  const THUMB = 160;
  const canvas = document.createElement('canvas');
  canvas.width = THUMB; canvas.height = THUMB;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, THUMB, THUMB);
  return canvas.toDataURL('image/jpeg', 0.82);
}

async function vizAddToProposal() {
  if (!vizState.currentImageSrc) {
    showToast('Generate a mockup first', 'toast-info'); return;
  }
  const btn = event && event.target;
  if (btn) { btn.textContent = 'Exporting…'; btn.disabled = true; }

  try {
    const png = await vizExportPNG();
    // Uploaded to Storage rather than kept as base64 — resolves the Phase 2
    // TODO on proposals.mockup_image_url (propSave's own fallback logic
    // needs no changes for this: it already just treats _vizProposalMockup
    // as an opaque string, whether that string used to be base64 or is now
    // a URL). If the upload fails, leave _vizProposalMockup unset rather
    // than falling back to attaching a giant base64 blob — that would
    // undo the exact thing Storage exists to fix.
    const mockupUrl = await _vizUploadImage(png || vizState.currentImageSrc, 'mockup');
    if (mockupUrl) window._vizProposalMockup = mockupUrl;
    else showToast('Mockup could not be uploaded — proposal will keep its previous mockup, if any', 'toast-error');

    let added = 0;
    for (const c of vizState.callouts) {
      const thumb = await vizCropCalloutThumb(c);
      let name = c.label, price = c.price || '', sku = c.sku || '', cat = 'Venue Item';
      if (c.sku) {
        const card = document.querySelector(`#inv-grid .inv-card[data-sku="${c.sku}"]`);
        if (card) {
          cat = card.dataset.cat || cat;
          if (!price && card.dataset.price && card.dataset.price !== 'MP') price = card.dataset.price;
        }
      }
      propItemIdCounter++;
      proposalItems.push({ id: propItemIdCounter, name, cat, price, sku, qty: 1, notes: '', area: '', imgSrc: thumb, isVenueItem: true });
      added++;
    }

    propRender();
    navigate('proposals');
    showToast('✓ Mockup added to proposal' + (added ? ` · ${added} item${added>1?'s':''} added` : ''), 'toast-success');
  } catch(e) {
    showToast('Export failed: ' + e.message, 'toast-error');
  } finally {
    if (btn) { btn.textContent = 'Add to Proposal →'; btn.disabled = false; }
  }
}

async function vizIdentifyItems(btn) {
  if (!vizState.currentImageSrc) { showToast('Generate a mockup first', 'toast-info'); return; }

  const origText = btn ? btn.textContent : '';
  if (btn) { btn.textContent = 'Identifying…'; btn.disabled = true; }

  try {
    const match = vizState.currentImageSrc.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid image source');
    const [, mime, b64] = match;

    const data = await _vizAiProxy('anthropic', {
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mime, data: b64 } },
          { type: 'text', text:
            'You are an expert event rental consultant. Identify all visible items in this venue mockup that an event company could rent (chairs, tables, linens, draping, lighting, centerpieces, floral, décor, etc.).\n\n'
          + 'For each item, estimate its center position as normalized coordinates where 0,0 = top-left and 1,1 = bottom-right.\n\n'
          + 'Reply ONLY with a raw JSON array — no markdown fences, no explanation:\n'
          + '[{"label":"item name","category":"Furniture|Lighting|Décor|Linen|Floral|Other","nx":0.0,"ny":0.0,"price":""}]\n\n'
          + 'Identify up to 8 distinct rentable items clearly visible in the image. Set price to a realistic rental estimate like "$120" or leave empty.'
          }
        ]
      }]
    });
    let raw = (data.content && data.content[0] ? data.content[0].text : '').trim();
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let items;
    try { items = JSON.parse(raw); } catch(e) { throw new Error('Could not parse response'); }
    if (!Array.isArray(items) || !items.length) { showToast('No items detected', 'toast-info'); return; }

    items.forEach(item => {
      const nx = Math.max(0.05, Math.min(0.95, parseFloat(item.nx) || 0.5));
      const ny = Math.max(0.05, Math.min(0.95, parseFloat(item.ny) || 0.5));
      const color = VIZ_CALLOUT_COLORS[vizState.callouts.length % VIZ_CALLOUT_COLORS.length];
      vizState.callouts.push({ id: ++_vizCalloutIdSeq, nx, ny, label: (item.label || 'Item').trim(), price: (item.price || '').trim(), sku: '', color });
    });

    vizRenderCallouts();
    vizRenderCalloutList();
    showToast(`✓ ${items.length} item${items.length > 1 ? 's' : ''} identified — review and adjust positions`, 'toast-success');
  } catch(e) {
    showToast('Identify failed: ' + e.message, 'toast-error');
  } finally {
    if (btn) { btn.textContent = origText; btn.disabled = false; }
  }
}

async function vizAddToProposalDirect() {
  if (!vizState.currentImageSrc) { showToast('No mockup to add', 'toast-info'); return; }
  const mockupUrl = await _vizUploadImage(vizState.currentImageSrc, 'mockup');
  if (!mockupUrl) { showToast('Mockup could not be uploaded — try again', 'toast-error'); return; }
  window._vizProposalMockup = mockupUrl;
  navigate('proposals');
  propRender();
  showToast('✓ Mockup attached to proposal', 'toast-success');
}
