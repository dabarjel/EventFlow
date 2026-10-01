// Dashboard screen.

// ── TASK CHECKBOXES ──────────────────────────────────────────────────────────
function toggleTask(cb) {
  const span = cb.nextElementSibling;
  if (!span) return;
  span.style.textDecoration = cb.checked ? 'line-through' : '';
  span.style.color          = cb.checked ? 'var(--text-4)'  : '';
}
// applyInvEdits() called after inventory.js loads

// ── Dashboard stats (live from Supabase) ──────────────────────────────────────
async function renderDashboard() {
  await _authReady; // called at page-init time, before sign-in may have resolved — see _authReady's comment
  const saved   = await getSavedProposals();
  const active  = saved.filter(p => !['complete','cancelled'].includes(p.status||'draft'));
  const totalRevenue = saved.reduce((a, p) => a + (p.total || 0), 0);

  const statEl = document.getElementById('stat-proposals');
  const subEl  = document.getElementById('stat-proposals-sub');
  if (statEl) statEl.textContent = active.length || '0';
  if (subEl)  subEl.textContent  = saved.length
    ? active.length + ' active · ' + saved[0].clientName + ' most recent'
    : 'None yet — start building';

  const revEl = document.getElementById('stat-revenue');
  if (revEl) revEl.textContent = '$' + totalRevenue.toLocaleString('en-US');

  // Append real upcoming events from proposals to the upcoming events list.
  // Previously-injected rows are tagged with data-real-event so a revisit
  // clears just those instead of accumulating duplicates on top of them.
  const eventList = document.getElementById('dash-upcoming-events');
  if (!eventList) return;
  eventList.querySelectorAll('.event-row[data-real-event]').forEach(el => el.remove());
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = saved
    .filter(p => p.fields && p.fields.date && new Date(p.fields.date + 'T00:00:00') >= today)
    .sort((a, b) => new Date(a.fields.date) - new Date(b.fields.date))
    .slice(0, 4);

  if (!upcoming.length) return;
  const _esc = escapeHtml;
  const statusBadge = {draft:'badge-inquiry',sent:'badge-proposal',approved:'badge-approved',complete:'badge-complete'};
  upcoming.forEach(p => {
    const d   = new Date(p.fields.date + 'T00:00:00');
    const day = d.getDate();
    const mon = d.toLocaleDateString('en-US',{month:'short'});
    const row = document.createElement('div');
    row.className = 'event-row';
    row.dataset.realEvent = '1';
    row.style.cursor = 'pointer';
    row.onclick = () => propLoadProposal(p.key);
    row.innerHTML = `
      <div class="event-date"><div class="event-date-num">${day}</div><div class="event-date-mon">${mon}</div></div>
      <div class="event-info">
        <div class="event-name">${_esc(p.clientName)}</div>
        <div class="event-sub">${_esc((p.fields&&p.fields.venue)||'Venue TBD')} · ${(p.items||[]).length} items</div>
      </div>
      <span class="badge ${statusBadge[p.status||'draft']||'badge-inquiry'}">${p.status||'Draft'}</span>`;
    eventList.appendChild(row);
  });
}
