// Invoices & Payments screen.

// INVOICE — same idea: render the preview from the clicked row's own data.
function showInvoice(rowEl) {
  const preview = document.getElementById('invoice-preview');
  if (rowEl) {
    const name     = (rowEl.querySelector('.doc-name')   || {}).textContent || '';
    const sub      = (rowEl.querySelector('.doc-sub')    || {}).textContent || '';
    const amount   = (rowEl.querySelector('.doc-amount') || {}).textContent || '';
    const statusEl = rowEl.querySelector('.payment-status');
    const statusText = statusEl ? statusEl.textContent : '';
    const statusCls  = statusEl ? statusEl.className : 'payment-status status-pending';
    const isPaid = statusCls.includes('status-paid');
    const [invLabel, clientLabel] = name.split(' · ');
    const totalsHtml = isPaid
      ? `<div class="invoice-total-row"><span>Amount Paid</span><span>-${escapeHtml(amount)}</span></div><div class="invoice-grand"><span>Balance Due</span><span>$0.00</span></div>`
      : `<div class="invoice-grand"><span>Balance Due</span><span>${escapeHtml(amount)}</span></div>`;

    preview.innerHTML = `
      <div class="invoice-header">
        <div>
          <div class="invoice-logo">Da Vinci's Florist, LLC</div>
          <div style="font-size:12px;color:var(--stone);margin-top:6px;">2756 Garfield Ave<br>Silver Spring, MD 20910<br>devika@davinciflorist.com</div>
        </div>
        <div style="text-align:right;">
          <div class="invoice-title">Invoice</div>
          <div class="invoice-num">#${escapeHtml(invLabel || name)}</div>
          <div style="margin-top:10px;font-size:12px;color:var(--stone);">${escapeHtml(sub)}</div>
          <div style="margin-top:10px;"><span class="${statusCls}">${escapeHtml(statusText)}</span></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:24px;">
        <div><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--stone);margin-bottom:6px;">Bill To</div><div style="font-weight:500;">${escapeHtml(clientLabel || '—')}</div></div>
        <div style="text-align:right;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--stone);margin-bottom:6px;">Event</div><div>${escapeHtml(clientLabel || '—')}</div></div>
      </div>
      <table class="invoice-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody>
          <tr><td>Event rental package — see attached proposal for full itemization</td><td>1</td><td>${escapeHtml(amount)}</td><td>${escapeHtml(amount)}</td></tr>
        </tbody>
      </table>
      <div class="invoice-totals">
        <div class="invoice-total-row"><span>Subtotal</span><span>${escapeHtml(amount)}</span></div>
        ${totalsHtml}
      </div>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:12px;color:var(--stone);">Payment via bank transfer, check, or credit card.<br>Thank you for choosing Da Vinci's Florist, LLC.</div>
        <div style="display:flex;gap:10px;">
          <button class="btn" onclick="printInvoicePreview()">🖨️ Print</button>
          <button class="btn btn-primary" onclick="showToast('📧 Email functionality coming in a future update','toast-info')">Send Invoice</button>
        </div>
      </div>`;
  }
  preview.style.display = 'block';
  preview.scrollIntoView({behavior:'smooth', block:'start'});
}

// ── INVOICES FILTER ──────────────────────────────────────────────────────────
// Scopes the Invoices page to one client instead of just dumping the user on
// the generic unfiltered list — matches on any word of the client's name
// since the invoice rows are static demo data, not really linked to CRM records.
async function viewClientInvoices(clientId) {
  const clients = await getCRMClients();
  const c     = clients.find(x => x.id === clientId);
  const name  = c ? c.name : '';
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length > 2);

  navigate('invoices');
  setTimeout(() => {
    const input = document.querySelector('#section-invoices .search-box input');
    if (input) input.value = name;
    document.querySelectorAll('#section-invoices .filter-chip').forEach(ch => ch.classList.remove('active'));

    let anyMatch = false;
    document.querySelectorAll('#section-invoices .doc-row').forEach(row => {
      const text  = row.textContent.toLowerCase();
      const match = !words.length || words.some(w => text.includes(w));
      row.style.display = match ? '' : 'none';
      if (match) anyMatch = true;
    });
    if (!anyMatch) showToast('No invoices found for ' + (name || 'this client'), 'toast-info');
  }, 60);
}

function filterInvoices(el, status, searchOverride) {
  if (el) {
    el.closest('.filter-bar').querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
  }
  const q = searchOverride !== undefined
    ? searchOverride.toLowerCase()
    : (document.querySelector('#section-invoices .search-box input')||{value:''}).value.toLowerCase();
  const cls = {Paid:'status-paid', Pending:'status-pending', Overdue:'status-overdue'};
  document.querySelectorAll('#section-invoices .doc-row').forEach(row => {
    row.style.display =
      (!q || row.textContent.toLowerCase().includes(q)) &&
      (!status || (cls[status] && row.querySelector('.'+cls[status])))
      ? '' : 'none';
  });
}

// ── INVOICE PRINT ────────────────────────────────────────────────────────────
function printInvoicePreview() {
  const preview = document.getElementById('invoice-preview');
  if (!preview) { window.print(); return; }
  const w = window.open('', '_blank');
  const css = 'body{font-family:"Inter",sans-serif;padding:36px;color:#2A2822;}' +
    '.invoice-header{display:flex;justify-content:space-between;margin-bottom:32px;}' +
    '.invoice-logo{font-size:22px;font-family:"Playfair Display",serif;font-weight:600;}' +
    '.invoice-title{font-size:26px;font-family:"Playfair Display",serif;font-weight:600;color:#16301F;}' +
    'table{width:100%;border-collapse:collapse;margin:20px 0;}' +
    'th{padding:10px 14px;background:#F0ECE3;font-size:11px;text-transform:uppercase;letter-spacing:1px;text-align:left;}' +
    'td{padding:11px 14px;border-bottom:1px solid #E4DFD3;font-size:13px;}' +
    '.invoice-totals{text-align:right;margin-top:12px;}' +
    '.invoice-total-row,.invoice-grand{display:flex;justify-content:flex-end;gap:40px;padding:5px 0;font-size:13px;}' +
    '.invoice-grand{font-size:16px;font-weight:600;border-top:2px solid #2A2822;padding-top:10px;margin-top:6px;}' +
    '.payment-status{padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;display:inline-block;}' +
    '.status-paid{background:#E6F2EC;color:#2F7D5A;}.status-pending{background:#F5EEDD;color:#A6742D;}' +
    '@media print{@page{margin:0.5in;}}';
  w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice</title><style>' + css + '</style></head><body>' + preview.innerHTML + '</body></html>');
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 500);
}
