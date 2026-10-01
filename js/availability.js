// Availability calendar screen.

// ── AVAILABILITY CALENDAR ─────────────────────────────────────────────────────
const _calNow = new Date();
let calYear = _calNow.getFullYear(), calMonth = _calNow.getMonth();

async function _getCalEvents() {
  await _authReady; // called at page-init time, before sign-in may have resolved — see _authReady's comment
  // Build an index of events from saved proposals + pipeline seed data
  const proposals = await getSavedProposals();
  const events = {};

  // Seed events from static pipeline data (always visible even with no proposals saved)
  const seedEvents = [
    { date: '2025-06-14', name: 'Thompson–Reyes Wedding',    type: 'Wedding',    status: 'active'    },
    { date: '2025-06-18', name: 'Azure Tech Summit Gala',    type: 'Corporate',  status: 'contract'  },
    { date: '2025-06-22', name: 'Hargrove Anniversary Party',type: 'Anniversary',status: 'proposal'  },
    { date: '2025-06-29', name: 'Chen–Williams Wedding',     type: 'Wedding',    status: 'inquiry'   },
    { date: '2025-07-05', name: 'Morrison Corporate Dinner', type: 'Corporate',  status: 'active'    },
  ];
  seedEvents.forEach(ev => {
    if (!events[ev.date]) events[ev.date] = [];
    events[ev.date].push(ev);
  });

  proposals.forEach(p => {
    const date = p.fields && p.fields.date;
    if (!date) return;
    if (!events[date]) events[date] = [];
    events[date].push({
      date,
      name:   p.clientName || 'Event',
      type:   (p.fields && p.fields.eventType) || 'Event',
      status: p.status || 'draft',
      key:    p.key
    });
  });

  return events;
}

async function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const calEvents  = await _getCalEvents();
  const titleEl    = document.getElementById('cal-month-name');
  if (titleEl) titleEl.textContent = monthNames[calMonth] + ' ' + calYear;

  const firstDay    = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today       = new Date();
  const isCurrentMonth = (today.getFullYear() === calYear && today.getMonth() === calMonth);

  const cont   = document.getElementById('cal-days');
  const labels = [...cont.querySelectorAll('.cal-day-label')];
  cont.innerHTML = '';
  labels.forEach(l => cont.appendChild(l));

  for (let i = 0; i < firstDay; i++) {
    const d = document.createElement('div'); d.className = 'cal-day empty'; cont.appendChild(d);
  }

  const monthEvents = []; // collect events this month for the sidebar

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = calYear + '-' + String(calMonth + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const dayEvents = calEvents[dateStr] || [];

    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;

    if (isCurrentMonth && d === today.getDate()) {
      el.classList.add('today');
    }
    if (dayEvents.length > 0) {
      el.classList.add('has-event');
      el.title = dayEvents.map(e => e.name).join(' · ');
      el.onclick = () => {
        document.querySelectorAll('.cal-day').forEach(x => x.style.outline = '');
        el.style.outline = '2px solid var(--accent-border)';
        _showDayEvents(dayEvents, d, monthNames[calMonth]);
      };
      dayEvents.forEach(ev => monthEvents.push({d, dateStr, ...ev}));
    }
    cont.appendChild(el);
  }

  // Sort month events by day and render in sidebar
  monthEvents.sort((a, b) => a.d - b.d);
  _renderBookingsSidebar(monthEvents, monthNames[calMonth]);
}

function _renderBookingsSidebar(events, monthName) {
  const list  = document.getElementById('cal-booking-list');
  const title = document.getElementById('cal-bookings-title');
  if (!list) return;
  if (title) title.textContent = 'Events in ' + monthName + ' ' + calYear;
  if (!events.length) {
    list.innerHTML = '<div class="cal-empty-state"><div style="font-size:var(--fs-2xl);margin-bottom:8px;opacity:.35;">📅</div><div>No events scheduled this month.</div><button class="btn btn-primary" style="margin-top:12px;font-size:var(--fs-xs);" onclick="propNewBlank();navigate(\'proposals\')">+ Build a Proposal</button></div>';
    return;
  }
  const statusBadge = {
    active:   '<span class="badge badge-active">Active</span>',
    contract: '<span class="badge badge-contract">Signed</span>',
    proposal: '<span class="badge badge-proposal">Proposal</span>',
    inquiry:  '<span class="badge badge-inquiry">Inquiry</span>',
    draft:    '<span class="badge badge-inquiry">Draft</span>',
    sent:     '<span class="badge badge-proposal">Sent</span>',
    approved: '<span class="badge badge-approved">Approved</span>',
    complete: '<span class="badge badge-complete">Complete</span>',
  };
  // Deduplicate by name+date
  const seen = new Set();
  const unique = events.filter(ev => {
    const k = ev.name + ev.dateStr;
    if (seen.has(k)) return false; seen.add(k); return true;
  });
  list.innerHTML = unique.map(ev => `
    <div class="cal-booking-item" onclick="${ev.key ? `propLoadProposal('${ev.key}')` : "navigate('my-proposals')"}" title="${escapeHtml(ev.name)}">
      <div class="cal-booking-date">
        <div class="cal-booking-day">${ev.d}</div>
        <div class="cal-booking-mon">${ev.dateStr.slice(5,7) === String(_calNow.getMonth()+1).padStart(2,'0') ? '' : ev.dateStr.slice(5,7)}</div>
      </div>
      <div class="cal-booking-info">
        <div class="cal-booking-name">${escapeHtml(ev.name)}</div>
        <div class="cal-booking-sub">${escapeHtml(ev.type)}</div>
      </div>
      ${statusBadge[ev.status] || ''}
    </div>`).join('');
}

function _showDayEvents(events, day, monthName) {
  const rows = events.map(ev => {
    const clickable = ev.key ? ` onclick="propLoadProposal('${ev.key}');closeModal();" style="cursor:pointer;"` : '';
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border);"${clickable}><div style="font-size:var(--fs-md);font-weight:var(--weight-medium);">${escapeHtml(ev.name)}</div><div style="font-size:var(--fs-xs);color:var(--text-3);margin-top:2px;">${escapeHtml(ev.type)}</div></div>`;
  }).join('');
  document.getElementById('modal-content').innerHTML =
    `<div class="modal-title">${monthName} ${day}</div>${rows}<div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="navigate('my-proposals');closeModal()">View Proposals →</button></div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

function changeMonth(d) {
  calMonth += d;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}
