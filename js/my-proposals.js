// My Proposals screen.

// ── MY PROPOSALS PAGE ────────────────────────────────────────────────────────
const STATUS_LABELS = { draft:'Draft', sent:'Sent to Client', approved:'Approved', complete:'Complete' };
const STATUS_CHIPS  = { draft:'mp-chip-draft', sent:'mp-chip-sent', approved:'mp-chip-approved', complete:'mp-chip-complete' };

async function renderMyProposals() {
  const container = document.getElementById('mp-list');
  if (!container) return;
  let all = await getSavedProposals();
  const q = ((document.getElementById('mp-search-input')||{}).value||'').toLowerCase();
  const sf = ((document.getElementById('mp-status-filter')||{}).value||'');
  if (q)  all = all.filter(p => (p.clientName||'').toLowerCase().includes(q) || ((p.fields||{}).venue||'').toLowerCase().includes(q) || ((p.fields||{}).date||'').includes(q));
  if (sf) all = all.filter(p => (p.status||'draft') === sf);

  if (!all.length) {
    const isFiltered = !!(q || sf);
    if (isFiltered) {
      container.innerHTML = '<div class="mp-empty" style="padding:60px 20px;"><div style="font-size:var(--fs-2xl);margin-bottom:10px;opacity:.35;">☰</div><div style="font-weight:var(--weight-medium);font-size:var(--fs-md);color:var(--text);margin-bottom:6px;">No proposals match that search</div><div style="font-size:var(--fs-sm);margin-bottom:16px;">Try adjusting the search or status filter.</div><button class="btn" onclick="document.getElementById(\'mp-search-input\').value=\'\';document.getElementById(\'mp-status-filter\').value=\'\';renderMyProposals()">Clear Filter</button></div>';
    } else {
      container.innerHTML = '<div class="mp-empty" style="padding:80px 20px;"><div style="font-size:var(--fs-3xl);margin-bottom:16px;">📋</div><div style="font-size:var(--fs-lg);font-weight:var(--weight-medium);color:var(--text);margin-bottom:8px;">No proposals yet</div><div style="font-size:var(--fs-sm);color:var(--text-3);line-height:1.7;margin-bottom:20px;">Build a proposal in the <strong>Proposal Builder</strong>,<br>then click <strong>💾 Save</strong> to see it here.</div><button class="btn btn-primary" onclick="propNewBlank()">+ New Proposal</button></div>';
    }
    return;
  }

  const fmtMoney = n => '$' + Number(n||0).toLocaleString('en-US', {minimumFractionDigits:2});
  const initials = name => (name||'?').split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const avatarColors = ['#3F6B54','#2F5F8A','#7A5A1C','#5B4B9A','#8A3B35','#5E5E5E'];

  container.innerHTML = '';
  all.forEach((p, i) => {
    const f = p.fields || {};
    const total = p.total || 0;
    const payments = p.payments || [];
    const totalPaid = payments.reduce((a,x) => a + (x.amount||0), 0);
    const balance = Math.max(0, total - totalPaid);
    const pct = total > 0 ? Math.min(100, Math.round(totalPaid / total * 100)) : 0;
    const isPaid = balance <= 0 && total > 0;
    const status = p.status || 'draft';
    const color = avatarColors[i % avatarColors.length];

    const dateStr = f.date ? new Date(f.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'Date TBD';
    const venue = f.venue || 'Venue TBD';

    const paymentLogHtml = payments.map((pay, pi) => `
      <div class="mp-payment-entry" id="mp-pay-${p.key}-${pi}">
        <div style="display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;">
          <strong style="white-space:nowrap;">${fmtMoney(pay.amount)}</strong>
          <input type="text" value="${escapeHtml(pay.note || 'Payment')}"
            style="border:none;border-bottom:1px dashed var(--accent-text);background:transparent;font-size:var(--fs-xs);font-family:var(--font-sans);color:var(--text);outline:none;flex:1;min-width:80px;"
            onchange="mpEditPayment('${pay.id}','note',this.value)"
            title="Click to edit note">
          <input type="date" value="${pay.isoDate || ''}"
            style="border:none;border-bottom:1px dashed var(--accent-text);background:transparent;font-size:var(--fs-2xs);font-family:var(--font-sans);color:var(--text-3);outline:none;width:130px;"
            onchange="mpEditPayment('${pay.id}','date',this.value)"
            title="Click to change date">
          <span style="font-size:var(--fs-2xs);color:var(--text-3);">${!pay.isoDate ? '· '+pay.date : ''}</span>
        </div>
        <button class="mp-payment-del" onclick="mpDeletePayment('${pay.id}')" title="Remove">✕</button>
      </div>`).join('');

    const card = document.createElement('div');
    card.className = 'mp-card';
    card.innerHTML = `
      <div class="mp-card-top">
        <div class="mp-avatar" style="background:${color};">${escapeHtml(initials(p.clientName))}</div>
        <div class="mp-info">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <div class="mp-client">${escapeHtml(p.clientName)}</div>
            <span class="mp-status-chip ${STATUS_CHIPS[status]}">${STATUS_LABELS[status]}</span>
          </div>
          <div class="mp-meta">${dateStr} · ${escapeHtml(venue)} · ${(p.items||[]).length} items · Saved ${escapeHtml(p.savedAt||'')}</div>
        </div>
        <div>
          <div class="mp-total-label">Total</div>
          <div class="mp-total">${fmtMoney(total)}</div>
        </div>
      </div>

      <div class="mp-payment-bar">
        <div class="mp-payment-row"><span>Total Received</span><strong style="color:var(--text);">${fmtMoney(totalPaid)}</strong></div>
        <div class="mp-balance-row">
          <span style="font-size:var(--fs-sm);font-weight:var(--weight-medium);color:var(--text-3);">Balance Due</span>
          <span class="mp-balance-amount ${isPaid?'paid':'owing'}">${isPaid ? '✓ Paid in Full' : fmtMoney(balance)}</span>
        </div>
        <div class="mp-progress"><div class="mp-progress-fill" style="width:${pct}%;"></div></div>

        ${payments.length ? `<div class="mp-payment-log">${paymentLogHtml}</div>` : ''}

        <div class="mp-add-payment">
          <input type="number" placeholder="Amount received $" id="mp-amt-${p.key}" min="0" step="50" style="width:160px;">
          <input type="text" placeholder="Note (e.g. deposit, check)" id="mp-note-${p.key}" style="flex:1;min-width:120px;">
          <button class="btn btn-primary" style="font-size:var(--fs-xs);white-space:nowrap;" onclick="mpAddPayment('${p.key}')">+ Log Payment</button>
        </div>
      </div>

      <div class="mp-actions">
        <button class="btn btn-primary" style="font-size:var(--fs-xs);" onclick="propLoadProposal('${p.key}')">✏️ Edit Proposal</button>
        <button class="btn" style="font-size:var(--fs-xs);" onclick="mpPreview('${p.key}')">📄 Preview & Print</button>
        <select style="padding:5px 10px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);font-size:var(--fs-xs);font-family:var(--font-sans);background:var(--bg);color:var(--text);outline:none;" onchange="mpSetStatus('${p.key}',this.value)">
          ${Object.entries(STATUS_LABELS).map(([v,l]) => `<option value="${v}" ${v===status?'selected':''}>${l}</option>`).join('')}
        </select>
        <button class="btn btn-danger" style="font-size:var(--fs-xs);" onclick="mpDelete('${p.key}')">🗑 Delete</button>
      </div>`;
    container.appendChild(card);
  });
}

async function mpAddPayment(key) {
  const amtEl  = document.getElementById('mp-amt-' + key);
  const noteEl = document.getElementById('mp-note-' + key);
  const amt = parseFloat((amtEl||{}).value);
  if (!amt || amt <= 0) { if (amtEl) { amtEl.focus(); amtEl.style.borderColor='var(--danger-border)'; setTimeout(()=>amtEl.style.borderColor='',1500); } return; }
  const note = (noteEl||{}).value || 'Payment';
  if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }
  const now = new Date();
  const { error } = await sb.from('proposal_payments').insert({
    proposal_id: key, amount: amt, note, paid_on: now.toISOString().slice(0,10)
  });
  if (error) { showToast('Could not log payment: ' + error.message, 'toast-error'); return; }
  renderMyProposals();
}

// Payments are addressed by their own id now — no proposal key needed to
// scope the lookup, since a real uuid is already globally unique.
async function mpEditPayment(paymentId, field, value) {
  if (!sb) return;
  const patch = {};
  if (field === 'note') patch.note = value;
  else if (field === 'date') patch.paid_on = value || null;
  const { error } = await sb.from('proposal_payments').update(patch).eq('id', paymentId);
  if (error) showToast('Could not update payment: ' + error.message, 'toast-error');
  // Don't re-render (user is mid-edit) — balance will update on next render
}

async function mpDeletePayment(paymentId) {
  if (!confirm('Remove this payment record?')) return;
  if (!sb) return;
  const { error } = await sb.from('proposal_payments').delete().eq('id', paymentId);
  if (error) { showToast('Could not remove payment: ' + error.message, 'toast-error'); return; }
  renderMyProposals();
}

async function mpSetStatus(key, status) {
  if (!sb) return;
  const { error } = await sb.from('proposals').update({ status }).eq('id', key);
  if (error) { showToast('Could not update status: ' + error.message, 'toast-error'); return; }
  renderMyProposals();
}

async function mpDelete(key) {
  if (!confirm('Permanently delete this proposal? This cannot be undone.')) return;
  if (!sb) return;
  const { error } = await sb.from('proposals').delete().eq('id', key); // cascades to proposal_payments
  if (error) { showToast('Could not delete proposal: ' + error.message, 'toast-error'); return; }
  if (window._propEditingKey === key) { window._propEditingKey = null; _savedProp = null; }
  renderMyProposals();
}

function mpPreview(key) {
  propLoadProposal(key);
  setTimeout(() => { propSyncToDoc(); navigate('proposal-doc'); setTimeout(renderProposalDoc, 80); }, 200);
}
