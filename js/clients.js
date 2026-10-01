// Clients & CRM screen.

// ── CRM — Client Data (seed + dynamic from proposals) ────────────────────────
const _CRM_AVATAR_COLORS = ['var(--sage)','#185FA5','#854F0B','#5B21B6','#0F6E56','#C0392B','#8B6A72','#B8955A'];

// The five demo clients that used to seed a fresh crmClients_v1 key were
// always decorative/fake (CRM was never a named focus page during the design
// overhaul) — deliberately not ported to Supabase. Real staff on a real
// backend should see a genuinely empty CRM, not five fake people.
async function getCRMClients() {
  if (!sb) return [];
  const { data, error } = await sb.from('clients').select('*').order('created_at', { ascending: false });
  if (error) { showToast('Could not load clients: ' + error.message, 'toast-error'); return []; }
  return (data || []).map(c => ({
    id: c.id, name: c.name, email: c.email, phone: c.phone, initials: c.initials,
    color: c.color, type: c.type, dateStr: c.event_date, value: c.value,
    status: c.status, source: c.source, createdAt: new Date(c.created_at).getTime()
  }));
}

// Called from propSave() — creates or updates the client record and returns
// { clientId, error }. Returning the error (rather than just null on
// failure, the way Phase 1's functions do) matters here specifically: propSave
// must be able to tell "no client name was given" (error: null, clientId:
// null — fine, proceed) apart from "the write actually failed" (error set —
// propSave must NOT proceed to write the proposal, or a failed client upsert
// combined with a "successful" proposal save would orphan a proposal with no
// real client link, or leave a half-written client with no proposal pointing
// at it, depending on which half failed).
async function upsertCRMClient(proposal) {
  const name = (proposal.clientName || '').trim();
  if (!name) return { clientId: null, error: null };
  if (!sb) return { clientId: null, error: { message: 'Not connected to Supabase' } };

  const clients = await getCRMClients();
  // Prefer the stable id link when the proposal already carries one; name
  // matching is only a fallback for proposals saved before clientId existed.
  const match = (proposal.clientId && clients.find(c => c.id === proposal.clientId))
    || clients.find(c => c.name.toLowerCase() === name.toLowerCase());
  const f = proposal.fields || {};

  if (match) {
    const patch = {};
    if (f.email) patch.email = f.email;
    if (f.phone) patch.phone = f.phone;
    if (f.date)  patch.event_date = f.date;
    if (proposal.total > 0) patch.value = Math.max(match.value || 0, proposal.total);
    if (proposal.status) patch.status = proposal.status;
    const { error } = await sb.from('clients').update(patch).eq('id', match.id);
    return { clientId: error ? null : match.id, error };
  } else {
    const words    = name.split(/\s+/);
    const initials = ((words[0]||'')[0] + ((words[1]||'')[0]||'')).toUpperCase();
    const newClient = {
      name,
      email:       f.email || '',
      phone:       f.phone || '',
      initials,
      color:       _CRM_AVATAR_COLORS[clients.length % _CRM_AVATAR_COLORS.length],
      type:        f.eventType || 'Event',
      event_date:  f.date || '',
      value:       proposal.total || 0,
      status:      proposal.status || 'draft'
    };
    const { data, error } = await sb.from('clients').insert(newClient).select().single();
    return { clientId: error ? null : data.id, error };
  }
}

async function crmAddClientFromModal() {
  const first  = (document.getElementById('nc-first')  || {value:''}).value.trim();
  const last   = (document.getElementById('nc-last')   || {value:''}).value.trim();
  const email  = (document.getElementById('nc-email')  || {value:''}).value.trim();
  const phone  = (document.getElementById('nc-phone')  || {value:''}).value.trim();
  const source = (document.getElementById('nc-source') || {value:''}).value;
  const name   = (first + ' ' + last).trim();
  if (!name) { showToast('Enter at least a first or last name', 'toast-error'); return; }
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }

  const clients  = await getCRMClients();
  const initials = ((first[0] || '') + (last[0] || '')).toUpperCase() || name[0].toUpperCase();
  const { error } = await sb.from('clients').insert({
    name, email, phone, initials, source,
    color:      _CRM_AVATAR_COLORS[clients.length % _CRM_AVATAR_COLORS.length],
    type:       'Event',
    event_date: '',
    value:      0,
    status:     'inquiry'
  });
  if (error) { showToast('Could not add client: ' + error.message, 'toast-error'); return; }
  showToast('✓ Client added — ' + name, 'toast-success');
  closeModal();
  _crmRestoreFilter();
}

async function renderCRMTable(filterType, searchQuery) {
  const clients = await getCRMClients();
  const q       = (searchQuery || '').toLowerCase();
  const ft      = (filterType  || '').toLowerCase();
  const tbody   = document.getElementById('crm-table-body');
  if (!tbody) return;

  const statusBadge = {
    active:'<span class="badge badge-active">Active</span>',
    contract:'<span class="badge badge-contract">Contract</span>',
    proposal:'<span class="badge badge-proposal">Proposal</span>',
    inquiry:'<span class="badge badge-inquiry">Inquiry</span>',
    draft:'<span class="badge badge-inquiry">Draft</span>',
    sent:'<span class="badge badge-proposal">Sent</span>',
    approved:'<span class="badge badge-active">Approved</span>',
    complete:'<span class="badge badge-complete">Complete</span>',
  };

  const filtered = clients.filter(c => {
    const matchSearch = !q || (c.name + ' ' + c.email + ' ' + c.type).toLowerCase().includes(q);
    const matchType = !ft || ft === 'all' || ft === '' ||
      (ft === 'active'    ? (c.status === 'active' || c.status === 'contract') :
       c.type.toLowerCase().includes(ft));
    return matchSearch && matchType;
  });

  if (!filtered.length) {
    const isFiltered = !!(q || (ft && ft !== 'all'));
    if (isFiltered) {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:32px;text-align:center;color:var(--stone);"><div style="font-size:22px;margin-bottom:8px;opacity:.35;">◈</div><div style="font-weight:600;color:var(--charcoal);margin-bottom:6px;">No clients match that search</div><div style="font-size:12.5px;margin-bottom:14px;">Try a different name, email, or clear the filter.</div><button class="btn" onclick="document.querySelector(\'#section-clients .search-box input\').value=\'\';document.querySelectorAll(\'#section-clients .filter-chip\').forEach((c,i)=>c.classList.toggle(\'active\',i===0));filterClients(\'\',\'\')">Clear Filter</button></td></tr>';
    } else {
      tbody.innerHTML = '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--stone);"><div style="font-size:28px;margin-bottom:10px;opacity:.3;">◈</div><div style="font-weight:600;font-size:15px;color:var(--charcoal);margin-bottom:8px;">No clients yet</div><div style="font-size:13px;margin-bottom:16px;line-height:1.6;">Clients are added automatically when you save a proposal,<br>or you can add one manually.</div><button class="btn btn-primary" onclick="openModal(\'new-client\')">+ Add Client</button></td></tr>';
    }
    return;
  }

  const fmt = n => n > 0 ? '$' + Number(n).toLocaleString('en-US') : '—';
  const fmtDate = s => { if (!s) return '—'; const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
  const _esc = escapeHtml;

  tbody.innerHTML = filtered.map(c => `
    <tr onclick="showCRMClient('${_esc(c.id)}')" style="cursor:pointer;">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="client-avatar" style="background:${c.color};">${_esc(c.initials)}</div>
          <div>
            <div style="font-weight:600;">${_esc(c.name)}</div>
            <div style="font-size:11px;color:var(--stone);">${_esc(c.email)}</div>
          </div>
        </div>
      </td>
      <td>${_esc(c.type)}</td>
      <td>${fmtDate(c.dateStr)}</td>
      <td style="font-weight:600;">${fmt(c.value)}</td>
      <td>${statusBadge[c.status] || '<span class="badge badge-inquiry">Inquiry</span>'}</td>
    </tr>`).join('');
}

async function showCRMClient(id) {
  const clients   = await getCRMClients();
  const c         = clients.find(x => x.id === id);
  if (!c) return;
  const proposals = await getSavedProposals();
  const linked    = proposals.filter(p => p.clientId === c.id);
  const _esc      = escapeHtml;
  const fmt       = n => '$' + Number(n||0).toLocaleString('en-US',{minimumFractionDigits:2});
  const fmtDate   = s => { if (!s) return '—'; const d = new Date(s+'T00:00:00'); return d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}); };

  const linkedHtml = linked.length ? `
    <div style="margin-top:18px;">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--stone);margin-bottom:8px;">Linked Proposals (${linked.length})</div>
      ${linked.map(p => `
        <div onclick="propLoadProposal('${p.key}')" style="display:flex;justify-content:space-between;align-items:center;padding:9px 11px;background:var(--cream);border-radius:6px;border:1px solid var(--border);cursor:pointer;margin-bottom:5px;transition:border-color 0.12s;" onmouseover="this.style.borderColor='var(--sage)'" onmouseout="this.style.borderColor='var(--border)'">
          <div>
            <div style="font-size:12.5px;font-weight:600;">${_esc(p.clientName)}</div>
            <div style="font-size:11px;color:var(--stone);">${fmtDate((p.fields||{}).date)} · ${(p.items||[]).length} items</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:700;color:var(--sage-dark);">${fmt(p.total)}</div>
            <div style="font-size:10px;color:var(--stone);">${p.status||'draft'}</div>
          </div>
        </div>`).join('')}
    </div>` : '';

  document.getElementById('client-detail-panel').innerHTML = `
    <div class="client-details-card">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div class="client-detail-avatar" style="background:${c.color};">${_esc(c.initials)}</div>
        <div>
          <div class="detail-name">${_esc(c.name)}</div>
          <div class="detail-email">${_esc(c.email)}</div>
        </div>
      </div>
      <div>
        <div class="detail-row"><span class="detail-label">Phone</span><span>${_esc(c.phone)||'—'}</span></div>
        <div class="detail-row"><span class="detail-label">Event Type</span><span>${_esc(c.type)}</span></div>
        <div class="detail-row"><span class="detail-label">Event Date</span><span>${fmtDate(c.dateStr)}</span></div>
        <div class="detail-row"><span class="detail-label">Total Value</span><span style="font-weight:700;color:var(--sage-dark);">${fmt(c.value)}</span></div>
      </div>
      ${linkedHtml}
      <div style="display:flex;gap:8px;margin-top:18px;">
        <button class="btn" style="flex:1;font-size:12px;" onclick="propNewBlank();navigate('proposals')">+ New Proposal</button>
        <button class="btn btn-primary" style="flex:1;font-size:12px;" onclick="viewClientInvoices('${_esc(c.id)}')">View Invoices</button>
      </div>
    </div>`;
}

// Legacy stub (in case old code calls showClient)
function showClient(key) { showCRMClient('demo_' + ['Thompson','Azure','Hargrove','Chen','Nakamura'].indexOf(key) + 1); }

// ── CRM SEARCH & FILTER ──────────────────────────────────────────────────────
const CRM_FILTER_KEY = 'crmFilter_v1';

// Typing in the search box used to hardcode type='', silently discarding
// whichever filter chip (Wedding/Corporate/Active) was selected while
// leaving that chip still highlighted — this keeps them in sync.
function crmSearchInput(val) {
  const bar = document.querySelector('#section-clients .filter-bar');
  const activeChip = bar ? bar.querySelector('.filter-chip.active') : null;
  const oc = activeChip ? (activeChip.getAttribute('onclick') || '') : '';
  const type = (oc.match(/'([^']*)'/) || [])[1] || '';
  filterClients(val, type);
}

function filterClients(val, type) {
  try { localStorage.setItem(CRM_FILTER_KEY, JSON.stringify({ type: type || '', search: val || '' })); } catch(e) {}
  renderCRMTable(type || '', val || '');
}

function filterCRMType(el, type) {
  el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const searchInput = document.querySelector('#section-clients .search-box input');
  const search = searchInput ? searchInput.value : '';
  try { localStorage.setItem(CRM_FILTER_KEY, JSON.stringify({ type: type || '', search })); } catch(e) {}
  renderCRMTable(type, search);
}

function _crmRestoreFilter() {
  try {
    const saved = JSON.parse(localStorage.getItem(CRM_FILTER_KEY) || 'null');
    const type   = saved ? saved.type   : '';
    const search = saved ? saved.search : '';
    // Restore search input text
    const searchInput = document.querySelector('#section-clients .search-box input');
    if (searchInput && search) searchInput.value = search;
    // Activate the right type chip
    const bar = document.querySelector('#section-clients .filter-bar');
    if (bar) {
      bar.querySelectorAll('.filter-chip').forEach(c => {
        const oc = c.getAttribute('onclick') || '';
        const chipType = (oc.match(/'([^']*)'/) || [])[1] || '';
        c.classList.toggle('active', chipType === (type || ''));
      });
    }
    renderCRMTable(type, search);
  } catch(e) { renderCRMTable('', ''); }
}
