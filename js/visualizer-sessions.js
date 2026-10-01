// Venue Visualizer: saved sessions.

// ══════════════════════════════════════════════════════════════════════════════
// ── FEATURE 3: SAVE AND NAME VISUALIZER SESSIONS ─────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// Whether the currently-open proposal has a linked Venue Visualizer session.
// _propUpdateSessionLink() is called from propRender() on nearly every
// keystroke — same hot-path problem Phase 2 solved with _propCurrentPayments.
// Populated by propLoadProposal()/propNewBlank(), refreshed by
// vzaSessionDoSave()/vzaSessionDelete() when they touch the open proposal.
let _propHasLinkedSession = false;

async function _propRefreshHasLinkedSession(key) {
  if (!sb || !key) { _propHasLinkedSession = false; return; }
  const { data } = await sb.from('viz_sessions').select('id').eq('proposal_id', key).limit(1);
  _propHasLinkedSession = !!(data && data.length);
}

// Returns sessions shaped like the old localStorage records — same "keep
// the shape" strategy as getSavedProposals()/getCRMClients(). itemCount is
// derived from vzaItems.length rather than stored separately (it was always
// computed from the same array at save time, so storing it too would just
// be a second copy of the same number). venueBase64/venueMime are dropped —
// see vzaSessionRestore for why a real data: URL gets reconstructed instead
// of carrying those two fields forward.
async function vzaSessionGet() {
  if (!sb) return [];
  const { data, error } = await sb.from('viz_sessions').select('*').order('created_at', { ascending: false });
  if (error) { showToast('Could not load sessions: ' + error.message, 'toast-error'); return []; }
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    savedAt: new Date(row.created_at).getTime(),
    thumbnail: row.thumbnail_url,
    itemCount: (row.vza_items || []).length,
    proposalKey: row.proposal_id || '',
    stage: row.stage,
    venueImageUrl: row.venue_image_url,
    currentImageSrc: row.current_image_url,
    currentClaudeDesc: row.current_claude_desc,
    versions: (row.versions || []).map(v => ({ thumb: v.thumb_url, desc: v.desc })),
    callouts: row.callouts || [],
    fromProposal: row.from_proposal,
    vzaImgSrc: row.vza_img_url,
    vzaItems: (row.vza_items || []).map(i => ({ id:i.id, name:i.name, category:i.category, qty:i.qty, description:i.description, region:i.region, colorIdx:i.colorIdx, added:i.added, skipped:i.skipped })),
    vzaItemThumbs: (row.vza_items || []).reduce((acc, i) => { acc[i.id] = i.thumb_url || null; return acc; }, {}),
    vzaAddedCount: row.vza_added_count,
    cropEditorVisible: row.crop_editor_visible,
    cropMode: row.crop_mode
  }));
}

async function _vizMakeThumbnail(imgSrc) {
  if (!imgSrc) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 220;
      const ratio = img.naturalWidth / img.naturalHeight;
      const w = ratio >= 1 ? MAX : Math.round(MAX * ratio);
      const h = ratio >= 1 ? Math.round(MAX / ratio) : MAX;
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => resolve(null);
    img.src = imgSrc;
  });
}

async function vzaSessionSavePrompt() {
  const saved = await getSavedProposals();
  const propOpts = saved.map(p => `<option value="${escapeHtml(p.key)}">${escapeHtml(p.clientName || p.key)}</option>`).join('');

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">Save Visualizer Session</div>
    <div style="margin-bottom:12px;">
      <label style="font-size:var(--fs-2xs);font-weight:var(--weight-medium);text-transform:uppercase;letter-spacing:0.5px;color:var(--text-3);display:block;margin-bottom:4px;">Session Name</label>
      <input id="viz-sname-in" type="text" placeholder="e.g. Johnson Wedding – Ballroom"
        style="width:100%;padding:8px 10px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-size:var(--fs-sm);font-family:var(--font-sans);box-sizing:border-box;"
        onkeydown="if(event.key==='Enter')vzaSessionDoSave()">
    </div>
    ${saved.length ? `<div style="margin-bottom:12px;">
      <label style="font-size:var(--fs-2xs);font-weight:var(--weight-medium);text-transform:uppercase;letter-spacing:0.5px;color:var(--text-3);display:block;margin-bottom:4px;">Link to Proposal (optional)</label>
      <select id="viz-sprop-in" style="width:100%;padding:7px 10px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-size:var(--fs-xs);font-family:var(--font-sans);background:var(--surface);">
        <option value="">— No link —</option>${propOpts}
      </select>
    </div>` : ''}
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="vzaSessionDoSave()">Save Session</button>
    </div>`;
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => { const el = document.getElementById('viz-sname-in'); if (el) el.focus(); }, 60);
}

async function vzaSessionDoSave() {
  const nameEl  = document.getElementById('viz-sname-in');
  const propSel = document.getElementById('viz-sprop-in');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) { if (nameEl) { nameEl.focus(); nameEl.style.borderColor = 'var(--danger-border)'; } return; }
  closeModal();
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }

  const thumbImgSrc = vizState.currentImageSrc || vzaState.imgSrc || null;
  const thumbnailDataUrl = await _vizMakeThumbnail(thumbImgSrc);

  const stage = (['entry','input','generating','review','annotate','analyze']
    .find(s => { const el = document.getElementById('viz-stage-' + s); return el && el.classList.contains('active'); }) || 'entry');
  const cropEditorVisible = (document.getElementById('vza-crop-editor-wrap') || {}).style.display !== 'none';

  // Upload every present image independently — one failing shouldn't abort
  // the whole session save (same spirit as the old code's own "retry
  // without large images rather than lose the whole session" fallback).
  // Each upload is silent — a stack of individual toasts would just
  // overwrite each other (this app shows one toast at a time); the single
  // summary toast at the end lists everything that didn't make it.
  const failed = [];
  const uploadOne = async (dataUrl, prefix, label) => {
    if (!dataUrl) return null;
    const url = await _vizUploadImage(dataUrl, prefix, true);
    if (!url) failed.push(label);
    return url;
  };

  const venueDataUrl = vizState.venueBase64 ? ('data:' + (vizState.venueMime || 'image/jpeg') + ';base64,' + vizState.venueBase64) : null;
  const [venueImageUrl, currentImageUrl, thumbnailUrl, vzaImgUrl] = await Promise.all([
    uploadOne(venueDataUrl, 'venue', 'venue photo'),
    uploadOne(vizState.currentImageSrc, 'mockup', 'mockup image'),
    uploadOne(thumbnailDataUrl, 'thumb', 'session thumbnail'),
    uploadOne(vzaState.imgSrc, 'analyze', 'analyzed photo')
  ]);

  const vzaItems = await Promise.all(vzaState.items.map(async i => {
    const thumb_url = i.thumbSrc ? await uploadOne(i.thumbSrc, 'item', '"' + i.name + '" thumbnail') : null;
    return { id:i.id, name:i.name, category:i.category, qty:i.qty, description:i.description, region:i.region, colorIdx:i.colorIdx, added:i.added, skipped:i.skipped, thumb_url };
  }));

  const versions = await Promise.all(vizState.versions.map(async v => ({
    thumb_url: v.thumb ? await uploadOne(v.thumb, 'version', 'a version thumbnail') : null,
    desc: v.desc
  })));

  const row = {
    name,
    proposal_id: (propSel && propSel.value) ? propSel.value : null,
    stage,
    venue_image_url: venueImageUrl,
    current_image_url: currentImageUrl,
    current_claude_desc: vizState.currentClaudeDesc,
    versions,
    callouts: vizState.callouts,
    from_proposal: vizState.fromProposal,
    vza_img_url: vzaImgUrl,
    vza_items: vzaItems,
    vza_added_count: vzaState.addedCount,
    crop_editor_visible: cropEditorVisible,
    crop_mode: _vzaCropMode,
    thumbnail_url: thumbnailUrl
  };

  const { error } = await sb.from('viz_sessions').insert(row);
  if (error) { showToast('Could not save session: ' + error.message, 'toast-error'); return; }

  showToast(failed.length
    ? '✓ Session saved: ' + name + ' — but could not upload: ' + failed.join(', ')
    : '✓ Session saved: ' + name, failed.length ? 'toast-error' : 'toast-success');

  await _propRefreshHasLinkedSession(window._propEditingKey);
  _propUpdateSessionLink();
}

async function vzaSessionRestore(id) {
  const sessions = await vzaSessionGet();
  const s = sessions.find(x => x.id === id);
  if (!s) { showToast('Session not found', 'toast-error'); return; }

  // Reconstruct real "data:mime;base64,..." strings, not just URLs —
  // vizIdentifyItems and vzaAnalyzePhoto both regex-parse currentImageSrc/
  // vzaState.imgSrc directly for a Claude vision call, so a restored session
  // needs to hand back the exact same shape those two features expect.
  const venueDataUrl = await _urlToDataUrl(s.venueImageUrl);
  const venueMatch = venueDataUrl ? venueDataUrl.match(/^data:([^;]+);base64,(.+)$/) : null;
  vizState.venueBase64       = venueMatch ? venueMatch[2] : null;
  vizState.venueMime         = venueMatch ? venueMatch[1] : 'image/jpeg';
  vizState.currentImageSrc   = await _urlToDataUrl(s.currentImageSrc);
  vizState.currentClaudeDesc = s.currentClaudeDesc || null;
  vizState.versions          = (s.versions || []).map(v => ({ thumb: v.thumb, desc: v.desc, src: null }));
  vizState.callouts          = s.callouts         || [];
  vizState.fromProposal      = s.fromProposal     || false;
  vzaState.imgSrc     = await _urlToDataUrl(s.vzaImgSrc);
  vzaState.addedCount = s.vzaAddedCount || 0;
  const thumbs = s.vzaItemThumbs || {};
  vzaState.items = (s.vzaItems || []).map(i => Object.assign({}, i, { thumbSrc: thumbs[i.id] || null }));
  if (vzaState.imgSrc) { vzaState.imgEl = new Image(); vzaState.imgEl.src = vzaState.imgSrc; }

  // Save restored state as current persist state (vizState_v1 stays
  // localStorage — see Phase 3 plan, this key isn't migrating)
  _vizDoSave();
  vzaSessionClosePanel();
  navigate('visualizer');
  showToast('✓ Session restored: ' + s.name, 'toast-success');
}

async function vzaSessionDelete(id) {
  if (!confirm('Delete this session?')) return;
  if (!sb) return;
  const { error } = await sb.from('viz_sessions').delete().eq('id', id);
  if (error) { showToast('Could not delete session: ' + error.message, 'toast-error'); return; }
  vzaSessionRenderPanel();
  showToast('Session deleted', 'toast-info');
  await _propRefreshHasLinkedSession(window._propEditingKey);
  _propUpdateSessionLink();
}

async function vzaSessionRename(id) {
  if (!sb) return;
  const sessions = await vzaSessionGet();
  const s = sessions.find(x => x.id === id);
  if (!s) return;
  const newName = prompt('Rename session:', s.name);
  if (!newName || !newName.trim()) return;
  const { error } = await sb.from('viz_sessions').update({ name: newName.trim() }).eq('id', id);
  if (error) { showToast('Could not rename session: ' + error.message, 'toast-error'); return; }
  vzaSessionRenderPanel();
}

function vzaSessionOpenPanel() {
  vzaSessionRenderPanel();
  document.getElementById('viz-sessions-overlay').classList.add('open');
}
function vzaSessionClosePanel() {
  document.getElementById('viz-sessions-overlay').classList.remove('open');
}

async function vzaSessionRenderPanel() {
  const body = document.getElementById('viz-sessions-panel-body');
  if (!body) return;
  const sessions = await vzaSessionGet();
  if (!sessions.length) {
    body.innerHTML = '<div class="viz-lib-empty">No saved sessions yet.<br>Click "Save Session" in the Venue Visualizer toolbar to save your current state.</div>';
    return;
  }
  const count = document.createElement('div');
  count.style.cssText = 'font-size:var(--fs-2xs);color:var(--text-3);margin-bottom:14px;';
  count.textContent = sessions.length + ' session' + (sessions.length !== 1 ? 's' : '') + ' saved';

  const grid = document.createElement('div'); grid.className = 'viz-sessions-grid';
  sessions.forEach(s => {
    const card = document.createElement('div'); card.className = 'viz-session-card';
    const thumbDiv = document.createElement('div'); thumbDiv.className = 'viz-session-thumb-ph';
    if (s.thumbnail) {
      const img = document.createElement('img'); img.src = s.thumbnail; img.alt = s.name;
      thumbDiv.appendChild(img);
    } else { thumbDiv.textContent = '✦'; }
    card.appendChild(thumbDiv);

    const sbody = document.createElement('div'); sbody.className = 'viz-session-body';
    sbody.innerHTML = `<div class="viz-session-name">${escapeHtml(s.name)}</div>
      <div class="viz-session-meta">${new Date(s.savedAt).toLocaleDateString()} · ${s.itemCount || 0} item${s.itemCount !== 1 ? 's' : ''}</div>
      ${s.proposalKey ? `<div class="viz-session-link-tag">Linked to proposal</div>` : ''}`;
    card.appendChild(sbody);

    const acts = document.createElement('div'); acts.className = 'viz-session-actions';
    const restoreBtn = document.createElement('button'); restoreBtn.className = 'viz-session-restore'; restoreBtn.textContent = 'Restore';
    restoreBtn.onclick = () => vzaSessionRestore(s.id);
    const renameBtn = document.createElement('button'); renameBtn.className = 'viz-session-del'; renameBtn.textContent = 'Rename';
    renameBtn.style.cssText = 'border-color:var(--border-strong);color:var(--text-3);';
    renameBtn.onclick = () => vzaSessionRename(s.id);
    const delBtn = document.createElement('button'); delBtn.className = 'viz-session-del'; delBtn.textContent = '×';
    delBtn.onclick = () => vzaSessionDelete(s.id);
    acts.appendChild(restoreBtn); acts.appendChild(renameBtn); acts.appendChild(delBtn);
    card.appendChild(acts); grid.appendChild(card);
  });
  body.innerHTML = ''; body.appendChild(count); body.appendChild(grid);
}

// Navigate to visualizer and restore session linked to the current proposal
// — click-triggered, not a hot path, so a real fetch here is fine (unlike
// _propUpdateSessionLink below).
async function vzaSessionFromProposal() {
  const key = window._propEditingKey;
  if (!key) return;
  const sessions = await vzaSessionGet();
  const s = sessions.find(x => x.proposalKey === key);
  if (!s) return;
  vzaSessionRestore(s.id);
}

// Show/hide "View Visualizer Session" link in proposal builder. Reads the
// _propHasLinkedSession cache rather than fetching — this is called from
// propRender() on nearly every keystroke (see the cache's own comment).
function _propUpdateSessionLink() {
  const link = document.getElementById('prop-session-link');
  if (!link) return;
  link.style.display = (window._propEditingKey && _propHasLinkedSession) ? '' : 'none';
}
