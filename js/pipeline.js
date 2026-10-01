// Event Pipeline screen.

function openEventDetail(cardEl) {
  const name  = (cardEl.querySelector('.pipeline-card-name')  || {}).textContent || 'Event';
  const meta  = (cardEl.querySelector('.pipeline-card-meta')  || {}).textContent || '';
  const value = (cardEl.querySelector('.pipeline-card-value') || {}).textContent || '—';
  // Determine column to set badge
  const col = cardEl.closest('.pipeline-col');
  const headerText = col ? (col.querySelector('.pipeline-header span') || {}).textContent || '' : '';
  const badgeMap = { 'Inquiry': 'badge-inquiry', 'Proposal': 'badge-proposal', 'Contract Signed': 'badge-contract', 'Active / Prep': 'badge-active', 'Complete': 'badge-complete' };
  const badgeClass = badgeMap[headerText.trim()] || 'badge-inquiry';
  openModal('event-detail');
  // Populate dynamic fields after the modal HTML is injected
  setTimeout(() => {
    const t = document.getElementById('ed-title');   if (t) t.textContent = name;
    const m = document.getElementById('ed-meta');    if (m) m.textContent = meta;
    const v = document.getElementById('ed-value');   if (v) v.textContent = value;
    const b = document.getElementById('ed-badge');
    if (b) { b.className = 'badge ' + badgeClass; b.style.cssText = 'font-size:var(--fs-xs);padding:5px 12px;'; b.textContent = headerText.trim() || 'Event'; }
  }, 10);
}

// ── PIPELINE SEARCH ──────────────────────────────────────────────────────────
function filterPipeline(val) {
  const v = (val || '').toLowerCase().trim();
  document.querySelectorAll('.pipeline-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = !v || text.includes(v) ? '' : 'none';
  });
  _pipelineRefreshCounts();
}

// Column header counts reflect however many cards are currently visible
// (post-filter) instead of hand-typed numbers that drift out of sync.
function _pipelineRefreshCounts() {
  document.querySelectorAll('.pipeline-col').forEach(col => {
    const count = Array.from(col.querySelectorAll('.pipeline-card')).filter(c => c.style.display !== 'none').length;
    const countEl = col.querySelector('.pipeline-header span:last-child');
    if (countEl) countEl.textContent = count;
  });
}

// ── PIPELINE TYPE FILTER ─────────────────────────────────────────────────────
function filterPipelineType(type) {
  const cards = document.querySelectorAll('.pipeline-card');
  cards.forEach(c => {
    c.style.display = (!type || c.dataset.type === type) ? '' : 'none';
  });
  _pipelineRefreshCounts();
}

// ── Create New Event ──────────────────────────────────────────────────────────
// Creates a real, persisted CRM inquiry — the Event Pipeline kanban is 100%
// static demo data with no real backing store, so a "new event" is recorded
// as a CRM client (status: inquiry) rather than faked into the pipeline/
// dashboard DOM, which used to vanish on reload and leak into whichever
// page happened to be open via a `.event-list` / `.stat-value` first-match.
// Note: the original localStorage version also stashed ad-hoc venue/guests
// fields on the client record, but nothing anywhere ever read them back
// (confirmed by search) — dropped rather than added to the clients schema
// for two write-only fields.
async function createNewEvent() {
  const client = (document.getElementById('ne-client')||{value:''}).value.trim();
  const type   = (document.getElementById('ne-type')||{value:'Event'}).value;
  const dateVal= (document.getElementById('ne-date')||{value:''}).value;
  const email  = (document.getElementById('ne-email')||{value:''}).value.trim();
  const phone  = (document.getElementById('ne-phone')||{value:''}).value.trim();
  const value  = parseFloat((document.getElementById('ne-value')||{value:''}).value.replace(/[^0-9.]/g,'')) || 0;

  if (!client) { showToast('Enter a client name', 'toast-error'); return; }
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }

  const clients  = await getCRMClients();
  const words    = client.split(/\s+/);
  const initials = ((words[0]||'')[0] + ((words[1]||'')[0]||'')).toUpperCase();
  const { error } = await sb.from('clients').insert({
    name: client, email, phone, initials,
    color:      _CRM_AVATAR_COLORS[clients.length % _CRM_AVATAR_COLORS.length],
    type:       type || 'Event',
    event_date: dateVal || '',
    value,
    status:     'inquiry'
  });
  if (error) { showToast('Could not add event: ' + error.message, 'toast-error'); return; }

  showToast('✓ Event added — ' + client, 'toast-success');
  closeModal();
  navigate('clients');
}
