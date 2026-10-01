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
  const totalValue = saved.reduce((a, p) => a + (p.total || 0), 0);
  const _esc = escapeHtml;
  const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
  const today = new Date(); today.setHours(0,0,0,0);
  const upcomingAll = saved
    .filter(p => p.fields && p.fields.date && new Date(p.fields.date + 'T00:00:00') >= today)
    .sort((a, b) => new Date(a.fields.date) - new Date(b.fields.date));
  const fmtDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  setText('stat-events', upcomingAll.length);
  setText('stat-events-sub', upcomingAll.length ? 'Next: ' + fmtDate(upcomingAll[0].fields.date) + ', ' + upcomingAll[0].clientName : 'No upcoming event dates yet');
  setText('stat-revenue', '$' + totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }));
  setText('stat-revenue-sub', saved.length ? 'Across ' + saved.length + ' proposal' + (saved.length === 1 ? '' : 's') : 'No proposals yet');
  setText('stat-proposals', active.length);
  setText('stat-proposals-sub', saved.length ? active.length + ' active, ' + saved[0].clientName + ' most recent' : 'None yet. Start building.');

  // Proposals by status
  const statusList = document.getElementById('dash-status-list');
  if (statusList) {
    const STATUS = [['draft', 'Draft', 'badge-inquiry'], ['sent', 'Sent', 'badge-proposal'], ['approved', 'Approved', 'badge-approved'], ['complete', 'Complete', 'badge-complete']];
    statusList.innerHTML = saved.length
      ? STATUS.map(([key, label, cls]) => {
          const n = saved.filter(p => (p.status || 'draft') === key).length;
          return `<button type="button" class="dash-status-row" onclick="navigate('my-proposals')"><span class="badge ${cls}">${label}</span><span class="dash-status-count">${n}</span></button>`;
        }).join('')
      : '<div class="dash-empty">No proposals yet. Use New proposal to build the first one.</div>';
  }

  // Upcoming events: real proposals with a future date, or an empty state
  const eventList = document.getElementById('dash-upcoming-events');
  if (!eventList) return;
  eventList.querySelectorAll('.event-row[data-real-event]').forEach(el => el.remove());
  const empty = document.getElementById('dash-upcoming-empty');
  const upcoming = upcomingAll.slice(0, 5);
  if (empty) {
    empty.textContent = 'No upcoming events. Event dates come from saved proposals.';
    empty.style.display = upcoming.length ? 'none' : '';
  }
  const statusBadge = {draft:'badge-inquiry',sent:'badge-proposal',approved:'badge-approved',complete:'badge-complete'};
  const statusLabel = {draft:'Draft',sent:'Sent',approved:'Approved',complete:'Complete'};
  upcoming.forEach(p => {
    const d   = new Date(p.fields.date + 'T00:00:00');
    const row = document.createElement('div');
    row.className = 'event-row';
    row.dataset.realEvent = '1';
    row.style.cursor = 'pointer';
    row.onclick = () => propLoadProposal(p.key);
    const st = p.status || 'draft';
    row.innerHTML = `
      <div class="event-date"><div class="event-date-num">${d.getDate()}</div><div class="event-date-mon">${d.toLocaleDateString('en-US',{month:'short'})}</div></div>
      <div class="event-info">
        <div class="event-name">${_esc(p.clientName)}</div>
        <div class="event-sub">${_esc((p.fields&&p.fields.venue)||'Venue TBD')}, ${(p.items||[]).length} items</div>
      </div>
      <span class="badge ${statusBadge[st]||'badge-inquiry'}">${_esc(statusLabel[st]||st)}</span>`;
    eventList.appendChild(row);
  });
}
