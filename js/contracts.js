// Contracts screen.

// CONTRACT — reads the clicked row's own visible data so each row opens its
// own record instead of always the same hardcoded contract.
function openContractDetail(rowEl) {
  const name    = (rowEl.querySelector('.doc-name')   || {}).textContent || '';
  const sub     = (rowEl.querySelector('.doc-sub')    || {}).textContent || '';
  const amount  = (rowEl.querySelector('.doc-amount') || {}).textContent || '';
  const badgeEl = rowEl.querySelector('.badge');
  const status  = badgeEl ? badgeEl.textContent : '';
  const badgeCls = badgeEl ? badgeEl.className : 'badge badge-inquiry';

  document.getElementById('modal-content').innerHTML = `
    <div class="modal-title">${escapeHtml(name)}</div>
    <div style="font-size:var(--fs-xs);color:var(--text-3);margin:-8px 0 14px;">${escapeHtml(sub)} &nbsp;·&nbsp; <span class="${badgeCls}">${escapeHtml(status)}</span></div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:18px;font-size:var(--fs-sm);line-height:1.8;max-height:360px;overflow-y:auto;">
      <div style="font-family:var(--font-heading);font-size:var(--fs-lg);margin-bottom:10px;">Event Rental Agreement</div>
      <p>This agreement is made between <strong>Da Vinci's Florist, LLC</strong> ("Company") and the client named above ("Client") for the event referenced in this contract.</p>
      <p style="margin-top:10px;"><strong>Total Value:</strong> ${escapeHtml(amount)}</p>
      <p style="margin-top:10px;"><strong>Rental Items:</strong> As itemized in the attached proposal and inventory list.</p>
      <p style="margin-top:10px;"><strong>Payment Terms:</strong> A non-refundable deposit of 50% is due upon signing. The remaining balance is due 30 days prior to the event.</p>
      <p style="margin-top:10px;"><strong>Cancellation Policy:</strong> Cancellations within 30 days forfeit deposit. Client is responsible for damage to rental items beyond normal wear and tear.</p>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Close</button><button class="btn btn-primary" onclick="showToast('PDF download coming in a future update','toast-info');closeModal()">⬇ Download PDF</button></div>`;
  document.getElementById('modal-overlay').classList.add('open');
}

// ── CONTRACTS FILTER ─────────────────────────────────────────────────────────
function filterContracts(el, status, searchOverride) {
  if (el) {
    el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }
  const q = searchOverride !== undefined
    ? searchOverride.toLowerCase()
    : (document.querySelector('#section-contracts .search-box input')||{value:''}).value.toLowerCase();
  const badge = {Draft:'badge-inquiry', Sent:'badge-proposal', Signed:'badge-complete'};
  document.querySelectorAll('#section-contracts .doc-row').forEach(row => {
    row.style.display =
      (!q || row.textContent.toLowerCase().includes(q)) &&
      (!status || (badge[status] && row.querySelector('.'+badge[status])))
      ? '' : 'none';
  });
}

// ── CONTRACT TEMPLATE EDIT ───────────────────────────────────────────────────
async function _contractsRestoreTemplate() {
  const tmpl = document.getElementById('contract-template-text');
  if (!tmpl || !sb) return;
  const { data, error } = await sb.from('settings').select('value').eq('key', 'contract_template').maybeSingle();
  if (error) { showToast('Could not load contract template: ' + error.message, 'toast-error'); return; }
  if (data && data.value && data.value.html) tmpl.innerHTML = data.value.html;
}

async function editContractTemplate() {
  const tmpl = document.getElementById('contract-template-text');
  const btn  = document.getElementById('contract-edit-btn');
  if (!tmpl || !btn) return;
  const editing = tmpl.contentEditable === 'true';
  tmpl.contentEditable = editing ? 'false' : 'true';
  tmpl.style.boxShadow = editing ? '' : '0 0 0 2px var(--accent-text)';
  btn.textContent      = editing ? '✏ Edit Template' : '✓ Done';
  if (!editing) {
    tmpl.focus();
    showToast('Template is editable — click Done when finished');
  } else {
    if (!sb) { showToast('Not connected to Supabase', 'toast-error'); return; }
    const { error } = await sb.from('settings').upsert({ key: 'contract_template', value: { html: tmpl.innerHTML } }, { onConflict: 'key' });
    if (error) showToast('Could not save template: ' + error.message, 'toast-error');
    else showToast('Template saved');
  }
}
