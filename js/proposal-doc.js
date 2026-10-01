// Proposal Document: custom line items, client-facing preview, PDF export, inline editing.

// ── PROPOSAL DOCUMENT GENERATOR

// ────────────────────────────────────────────────────────────────────────────
// ─── PROPOSAL DOCUMENT GENERATOR ───────────────────────────────────────────

let customLineItems = [];
let customItemCounter = 0;

function addCustomLineItem() {
  const id = ++customItemCounter;
  const div = document.createElement('div');
  div.id = 'cli-' + id;
  div.style.cssText = 'display:grid;grid-template-columns:2fr 3fr 60px 90px auto;gap:8px;align-items:center;margin-bottom:8px;padding:10px;background:var(--cream);border-radius:var(--radius-sm);border:1px solid var(--border);';
  div.innerHTML = `
    <input placeholder="Section (e.g. Adult Area)" id="cli-sec-${id}" style="padding:6px 8px;border:1px solid var(--border-mid);border-radius:6px;font-size:12px;font-family:var(--font-sans);">
    <input placeholder="Description" id="cli-desc-${id}" style="padding:6px 8px;border:1px solid var(--border-mid);border-radius:6px;font-size:12px;font-family:var(--font-sans);">
    <input placeholder="Qty" type="number" id="cli-qty-${id}" style="padding:6px 8px;border:1px solid var(--border-mid);border-radius:6px;font-size:12px;font-family:var(--font-sans);">
    <input placeholder="Unit $" type="number" id="cli-price-${id}" style="padding:6px 8px;border:1px solid var(--border-mid);border-radius:6px;font-size:12px;font-family:var(--font-sans);">
    <button onclick="removeCustomItem(${id})" style="padding:4px 10px;border:1px solid #B3261E;border-radius:6px;background:#fff;color:#B3261E;cursor:pointer;font-size:12px;">✕</button>`;
  document.getElementById('custom-line-items').appendChild(div);
  customLineItems.push(id);
}

function removeCustomItem(id) {
  const el = document.getElementById('cli-' + id);
  if (el) el.remove();
  customLineItems = customLineItems.filter(x => x !== id);
}

// Fold the "+ Add Custom Line Item" rows into proposalItems so they persist
// via propSave() — the customLineItems array + its DOM inputs are otherwise
// never written to localStorage and vanish on reload.
function _propMergeCustomLineItems() {
  customLineItems.slice().forEach(id => {
    const secEl   = document.getElementById('cli-sec-'   + id);
    const descEl  = document.getElementById('cli-desc-'  + id);
    const qtyEl   = document.getElementById('cli-qty-'   + id);
    const priceEl = document.getElementById('cli-price-' + id);
    const desc = descEl ? descEl.value.trim() : '';
    if (!desc) return; // leave blank rows in place for the user to fill in or remove
    const qty   = Math.max(1, parseFloat(qtyEl   ? qtyEl.value   : '1') || 1);
    const price = parseFloat(priceEl ? priceEl.value : '0') || 0;

    propItemIdCounter++;
    proposalItems.push({
      id:       propItemIdCounter,
      name:     desc,
      cat:      secEl ? secEl.value.trim() : '',
      price:    '$' + price.toFixed(2),
      sku:      'CUSTOM-' + propItemIdCounter,
      qty:      qty,
      notes:    '',
      area:     '',
      imgSrc:   '',
      isCustom: true
    });

    const rowEl = document.getElementById('cli-' + id);
    if (rowEl) rowEl.remove();
    customLineItems = customLineItems.filter(x => x !== id);
  });
}

function getProposalLineItems() {
  const items = [];
  proposalItems.forEach((item, idx) => {
    const p = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
    items.push({
      section:     item.cat    || '',
      area:        item.area   || '',
      description: item.name   || '',
      notes:       item.notes  || '',
      qty:         item.qty    || 1,
      unitPrice:   p,
      total:       p * (item.qty || 1),
      imgUrl:      item.imgSrc || '',
      isCustom:    item.isCustom || false,
      propIdx:     idx
    });
  });
  customLineItems.forEach(id => {
    const sec   = (document.getElementById('cli-sec-'  + id) || {value:''}).value;
    const desc  = (document.getElementById('cli-desc-' + id) || {value:''}).value;
    const qty   = parseFloat((document.getElementById('cli-qty-'  + id) || {value:'1'}).value) || 1;
    const price = parseFloat((document.getElementById('cli-price-'+ id) || {value:'0'}).value) || 0;
    if (desc) items.push({ section: sec, description: desc, notes: '', qty, unitPrice: price, total: qty * price, imgUrl: '', isCustom: false, propIdx: -1 });
  });
  return items;
}

function fmt(n) {
  return '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
}

function renderProposalDoc() {
  const gv = id => (document.getElementById(id) || {value:''}).value || '';

  // Render an editable field in the doc — shows placeholder if empty, green if filled
  function ef(value, placeholder, syncId) {
    const isEmpty = !value || !value.trim();
    const display = isEmpty ? placeholder : escapeHtml(value);
    const style = isEmpty
      ? 'color:#B3261E;font-style:italic;border-bottom:1.5px dashed #B3261E;cursor:text;outline:none;min-width:60px;display:inline-block;'
      : 'border-bottom:1px dashed transparent;cursor:text;outline:none;min-width:60px;display:inline-block;';
    const id = syncId ? ` data-sync="${syncId}"` : '';
    return `<span contenteditable="true" style="${style}"${id} onblur="propDocFieldBlur(this)" onfocus="this.style.borderBottomColor='#4A6741'">${display}</span>`;
  }

  const clientName  = gv('pd-client') || 'Client Name';
  const childName   = gv('pd-child');
  const phone       = gv('pd-phone');
  const email       = gv('pd-email');
  const adults      = gv('pd-adults');
  const kids        = gv('pd-kids');
  const pickup      = gv('pd-pickup');
  const planner     = gv('pd-planner');
  const theme       = gv('pd-theme');
  const notes       = gv('pd-notes');
  const venue       = gv('pd-venue');
  const dateVal     = gv('pd-date');
  const dateStr     = dateVal ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'}) : '';
  // Schedule rows come from the dynamic schedule builder via getScheduleData()
  const moodUrls    = gv('pd-moodboard').split('\n').map(s=>s.trim()).filter(Boolean);

  const lineItems = getProposalLineItems();
  const subtotal = lineItems.reduce((a,b) => a + b.total, 0);

  // Pull live rates from proposal builder inputs
  const _shipRate   = parseFloat((document.getElementById('prop-ship-rate') || {value:'20'}).value) || 20;
  const _taxRate    = parseFloat((document.getElementById('prop-tax-rate')  || {value:'6'}).value)  || 6;
  const _depositAmt = parseFloat((document.getElementById('prop-deposit')   || {value:'1000'}).value) || 0;

  const shipping = subtotal * (_shipRate / 100);
  const venueText = (document.getElementById('pd-venue').value || '').toUpperCase();
  const isDC = /WASHINGTON|\bDC\b/.test(venueText);
  const tax = (subtotal + shipping) * (_taxRate / 100);
  const taxLabel = 'Tax ' + _taxRate + '% (on subtotal + shipping)';
  const total = subtotal + shipping + tax;

  // Pull real payments from the same in-memory cache the builder's
  // propUpdateTotals() uses — kept in sync there, no need to duplicate a
  // fetch here (this doc is always synced from the currently-open proposal
  // via propSyncToDoc()).
  const _savedKey  = window._propEditingKey || null;
  const _payments  = _savedKey ? _propCurrentPayments : [];
  const _totalPaid = _payments.reduce((a, x) => a + (x.amount || 0), 0);
  const balanceDue = Math.max(0, total - _totalPaid);
  const _isPaid    = balanceDue <= 0 && total > 0;

  // Payment rows for the doc
  const _paymentRowsHtml = _payments.length > 0 ? _payments.map(pay =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid #F0ECE3;">
      <span style="color:#4A453D;">${escapeHtml(pay.note || 'Payment')} <span style="color:#9C9686;font-size:11px;">· ${escapeHtml(pay.date)}</span></span>
      <span style="color:#2F7D5A;font-weight:600;">−${fmt(pay.amount)}</span>
    </div>`
  ).join('') : '';

  // Payment deadline: 1 month before event date
  const eventDateVal = gv('pd-date');
  let balanceDueStr = 'one month prior to the event date';
  if (eventDateVal) {
    const evDate  = new Date(eventDateVal + 'T00:00:00');
    const dueDate = new Date(evDate);
    dueDate.setMonth(dueDate.getMonth() - 1);
    balanceDueStr = dueDate.toLocaleDateString('en-US', {month:'long', day:'numeric', year:'numeric'});
  }

  // Visual reference grid — one tile per unique image, using edited proposal names.
  // If multiple items share the same image, combine their names.
  const moodImgs = [];
  const moodLabels = {};
  if (moodUrls.length > 0) {
    moodImgs.push(...moodUrls);
  } else {
    proposalItems.forEach(item => {
      if (!item.imgSrc) return;
      if (!moodImgs.includes(item.imgSrc)) {
        moodImgs.push(item.imgSrc);
        moodLabels[item.imgSrc] = item.name;
      } else {
        // Same image, different name — append if different
        if (moodLabels[item.imgSrc] && !moodLabels[item.imgSrc].includes(item.name)) {
          moodLabels[item.imgSrc] += ' / ' + item.name;
        }
      }
    });
  }

  // Group line items by section
  const sections = {};
  lineItems.forEach(item => {
    const sec = item.section || 'Items';
    if (!sections[sec]) sections[sec] = [];
    sections[sec].push(item);
  });

  // Group line items by area (preserving order), then by section within each area
  const areaOrderDoc = [];
  const areaMapDoc = {};
  lineItems.forEach(item => {
    const a = item.area || '';
    if (!areaMapDoc[a]) { areaMapDoc[a] = []; areaOrderDoc.push(a); }
    areaMapDoc[a].push(item);
  });

  let lineItemRows = '';
  areaOrderDoc.forEach(area => {
    // Area separator — white bg, thin top rule, gold label in small caps
    if (area) {
      lineItemRows += `<tr class="prop-doc-item prop-doc-area"><td colspan="5" style="padding:16px 12px 4px;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#9C6B1F;border-top:2px solid #E4DFD3;">${escapeHtml(area)}</td></tr>`;
    }
    areaMapDoc[area].forEach(item => {
      const totalStr = item.total > 0 ? fmt(item.total) : '—';
      const priceStr = item.unitPrice > 0 ? fmt(item.unitPrice) : '—';
      const isCrop = item.isCustom && item.imgUrl && item.imgUrl.startsWith('data:');
      const safeDescription = escapeHtml(item.description);
      const safeNotes = escapeHtml(item.notes);
      const safeSection = escapeHtml(item.section);
      const safeQty = escapeHtml(item.qty);
      const imgHtml = item.imgUrl
        ? (isCrop
            ? `<img src="${item.imgUrl}" style="width:100%;height:auto;object-fit:contain;display:block;background:#f5f5f5;">`
            : `<img src="${item.imgUrl}" style="width:100%;height:100%;object-fit:cover;display:block;">`)
        : `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;background:#F7F5F2;"><span style="font-size:20px;opacity:0.4;">🌸</span><span style="font-size:9.5px;color:#9C9686;text-align:center;padding:0 8px;line-height:1.35;">${safeDescription}</span></div>`;
      const idxAttr = item.propIdx >= 0 ? ` data-prop-idx="${item.propIdx}"` : '';
      const editable = item.propIdx >= 0;
      lineItemRows += `
        <tr class="prop-doc-item" style="border-bottom:1px solid #E4DFD3;page-break-inside:avoid;">
          <td style="width:164px;padding:12px 12px 12px 0;vertical-align:top;">
            <div style="width:152px;${isCrop ? 'min-height:80px;' : 'height:120px;'}border-radius:6px;overflow:hidden;border:1px solid #E4DFD3;${isCrop ? 'background:#f5f5f5;' : ''}">
              ${imgHtml}
            </div>
          </td>
          <td style="padding:14px 12px;vertical-align:top;">
            ${editable
              ? `<div contenteditable="true"${idxAttr} data-prop-field="name" style="font-size:13px;font-weight:700;color:#1F3D2B;line-height:1.3;margin-bottom:5px;cursor:text;outline:none;border-radius:3px;" onblur="propDocItemBlur(this)" onfocus="this.style.background='#fffbf0'">${safeDescription}</div>`
              : `<div style="font-size:13px;font-weight:700;color:#1F3D2B;line-height:1.3;margin-bottom:5px;">${safeDescription}</div>`
            }
            ${item.notes || editable
              ? (editable
                  ? `<div contenteditable="true"${idxAttr} data-prop-field="notes" style="font-size:11px;color:#6B6455;line-height:1.6;cursor:text;outline:none;border-radius:3px;min-height:14px;" onblur="propDocItemBlur(this)" onfocus="this.style.background='#fffbf0'">${safeNotes}</div>`
                  : `<div style="font-size:11px;color:#6B6455;line-height:1.6;">${safeNotes}</div>`)
              : ''}
            ${item.section ? `<div style="font-size:8.5px;color:#9C6B1F;text-transform:uppercase;letter-spacing:1.5px;margin-top:6px;">${safeSection}</div>` : ''}
          </td>
          <td style="padding:14px 10px;vertical-align:middle;text-align:center;font-size:13px;color:#2A2822;white-space:nowrap;font-variant-numeric:tabular-nums;">
            ${editable
              ? `<span contenteditable="true"${idxAttr} data-prop-field="qty" style="cursor:text;outline:none;border-bottom:1px dashed #9C6B1F;min-width:20px;display:inline-block;border-radius:3px;" onblur="propDocItemBlur(this)" onfocus="this.style.background='#fffbf0'">${safeQty}</span>`
              : safeQty}
          </td>
          <td style="padding:14px 10px;vertical-align:middle;text-align:right;font-size:12px;color:#6B6455;white-space:nowrap;font-variant-numeric:tabular-nums;">
            ${editable
              ? `<span contenteditable="true"${idxAttr} data-prop-field="price" style="cursor:text;outline:none;border-bottom:1px dashed #9C6B1F;min-width:30px;display:inline-block;border-radius:3px;" onblur="propDocItemBlur(this)" onfocus="this.style.background='#fffbf0'">${priceStr}</span>`
              : priceStr}
          </td>
          <td style="padding:14px 12px 14px 10px;vertical-align:middle;text-align:right;font-size:13px;font-weight:700;color:#1F3D2B;white-space:nowrap;font-variant-numeric:tabular-nums;">
            <span${item.propIdx >= 0 ? ` id="pd-item-total-${item.propIdx}"` : ''}>${totalStr}</span>
          </td>
        </tr>`;
    });
  });

  const moodboardHtml = moodImgs.length > 0 ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;margin-bottom:28px;">
      ${moodImgs.map(url => {
        const label = moodUrls.length > 0 ? '' : (moodLabels[url] || '');
        return `<div style="overflow:hidden;border-radius:6px;background:#F0ECE3;aspect-ratio:4/3;position:relative;">
          <img src="${escapeHtml(url)}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.style.display='none'">
          ${label ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(26,58,92,0.78);color:#fff;font-size:9px;font-weight:700;padding:4px 7px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)}</div>` : ''}
        </div>`;
      }).join('')}
    </div>` : '';

  const notesHtml = notes ? `<div style="margin-bottom:22px;padding:12px 16px;border-left:3px solid #9C6B1F;font-size:11.5px;color:#4A453D;line-height:1.75;">${escapeHtml(notes).replace(/\n/g,'<br>')}</div>` : '';

  const scheduleRows = getScheduleData().map(r => {
    if (!r.phase && !r.setup && !r.start && !r.end && !r.pickup) return '';
    const parts = [r.setup ? 'Setup: '+escapeHtml(r.setup) : '', r.start ? 'Start: '+escapeHtml(r.start) : '', r.end ? 'End: '+escapeHtml(r.end) : '', r.pickup ? 'Pick-Up: '+escapeHtml(r.pickup) : ''].filter(Boolean).join(' · ');
    return `<tr><td style="padding:4px 10px;font-size:12px;color:#7A7672;width:120px;white-space:nowrap;font-weight:600;">${escapeHtml(r.phase)||'Phase'}</td><td style="padding:4px 10px;font-size:12px;">${parts}</td></tr>`;
  }).filter(Boolean).join('');

  const docHtml = `
  <div id="printable-proposal" style="background:#fff;max-width:800px;margin:0 auto;font-family:'Inter',sans-serif;color:#2A2822;border:1px solid #E4DFD3;border-radius:16px;overflow:hidden;box-shadow:0 24px 48px rgba(31,61,43,0.16);">

    <!-- HEADER — white background, gold top rule, thin bottom rule -->
    <div style="border-top:3px solid #9C6B1F;">
      <div style="padding:28px 36px 24px;display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #E4DFD3;">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:25px;font-weight:600;color:#1F3D2B;letter-spacing:-0.2px;line-height:1.1;">Da Vinci's Florist, LLC</div>
          <div style="font-size:10px;color:#9C9686;margin-top:8px;letter-spacing:0.1px;">2756 Garfield Ave &nbsp;·&nbsp; Silver Spring, Maryland 20910</div>
          <div style="font-size:10px;color:#9C9686;margin-top:2px;">(301) 588-8900 &nbsp;·&nbsp; devika@davinciflorist.com &nbsp;·&nbsp; davinciflorist.com</div>
        </div>
        <div style="text-align:right;padding-top:2px;">
          <div style="font-size:8.5px;color:#9C6B1F;letter-spacing:3px;text-transform:uppercase;font-weight:700;">Event Proposal</div>
          <div style="font-size:13px;color:#1F3D2B;margin-top:6px;font-weight:600;">${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</div>
          <div style="font-size:10px;color:#9C9686;margin-top:5px;">Preparer: <span contenteditable="true" id="doc-preparer-span" style="outline:none;border-bottom:1px dashed #9C6B1F;min-width:50px;display:inline-block;cursor:text;color:#6B6455;" title="Click to set your name — saves automatically" onblur="(function(el){var v=el.textContent.trim();if(v)localStorage.setItem('proposalPreparerName',v);})(this)" onfocus="this.style.borderBottomColor='#1F3D2B'">${escapeHtml(localStorage.getItem('proposalPreparerName'))||'Click to set name'}</span></div>
        </div>
      </div>
    </div>

    <!-- CLIENT INFO — white background, column dividers, gold bottom rule -->
    <div style="padding:20px 36px;display:grid;grid-template-columns:1fr 1fr 1fr 1fr;border-bottom:2px solid #9C6B1F;">
      <div style="padding-right:22px;border-right:1px solid #E4DFD3;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:7px;font-weight:700;">Client</div>
        <div style="font-size:13.5px;font-weight:700;color:#1F3D2B;line-height:1.2;">${ef(clientName,'Client Name','pd-client')}</div>
        ${childName ? `<div style="font-size:10.5px;color:#4A6741;font-weight:600;margin-top:4px;">Honoree: ${ef(childName,"Child's Name",'pd-child')}</div>` : `<div style="font-size:10.5px;color:#4A6741;font-weight:600;margin-top:4px;">${ef(childName,"Honoree name",'pd-child')}</div>`}
        <div style="font-size:10.5px;color:#6B6455;margin-top:4px;">${ef(phone,'Phone','pd-phone')}</div>
        <div style="font-size:10.5px;color:#6B6455;margin-top:1px;">${ef(email,'Email','pd-email')}</div>
      </div>
      <div style="padding:0 22px;border-right:1px solid #E4DFD3;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:7px;font-weight:700;">Date &amp; Venue</div>
        <div style="font-size:12px;font-weight:700;color:#1F3D2B;line-height:1.3;">${ef(dateStr,'Event Date','pd-date')}</div>
        <div style="font-size:10.5px;color:#4A453D;margin-top:4px;">${ef(venue,'Venue / Location','pd-venue')}</div>
        <div style="font-size:10.5px;color:#6B6455;margin-top:3px;">Planner: ${ef(planner,'Planner Name','pd-planner')}</div>
      </div>
      <div style="padding:0 22px;border-right:1px solid #E4DFD3;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:7px;font-weight:700;">Guests</div>
        <div style="font-size:11px;color:#2A2822;">Adults: <strong>${ef(adults,'—','pd-adults')}</strong></div>
        <div style="font-size:11px;color:#2A2822;margin-top:3px;">Kids: <strong>${ef(kids,'—','pd-kids')}</strong></div>
        <div style="font-size:10.5px;color:#6B6455;margin-top:5px;">Pick-Up: ${ef(pickup,'Date / Time','pd-pickup')}</div>
      </div>
      <div style="padding-left:22px;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:7px;font-weight:700;">Theme &amp; Colors</div>
        <div style="font-size:12px;font-weight:700;color:#1F3D2B;">${ef(theme,'Theme / Colors','pd-theme')}</div>
      </div>
    </div>

    <!-- EDIT HINT — hidden in print via .no-print -->
    <div class="no-print" style="padding:5px 36px;font-size:9.5px;color:#A6742D;border-bottom:1px solid #F5EEDD;">
      ✏️ <strong>Click any field to edit inline.</strong> Red fields are missing — fill them in or go back to Edit Details.
    </div>

    <div style="padding:28px 36px 0;">

      <!-- THEME + SCHEDULE -->
      ${theme || scheduleRows ? `<div style="display:flex;gap:20px;margin-bottom:24px;">
        ${theme ? `<div style="flex:1;padding:14px 16px;border:1px solid #E4DFD3;border-left:3px solid #9C6B1F;border-radius:0 6px 6px 0;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:5px;font-weight:700;">Theme &amp; Colors</div><div style="font-size:14px;font-weight:700;color:#1F3D2B;">${escapeHtml(theme)}</div></div>` : ''}
        ${scheduleRows ? `<div style="flex:2;border:1px solid #E4DFD3;border-radius:6px;padding:10px 14px;"><table style="width:100%;border-collapse:collapse;">${scheduleRows}</table></div>` : ''}
      </div>` : ''}

      <!-- NOTES -->
      ${notesHtml}

      <!-- AI VENUE MOCKUP (shown if Visualizer was used) -->
      ${(window._vizProposalMockup || (_savedProp && _savedProp.mockupImage)) ? `
      <div style="margin-bottom:28px;page-break-inside:avoid;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:10px;font-weight:700;">✦ Venue Visualizer Mockup</div>
        <img src="${window._vizProposalMockup || _savedProp.mockupImage}" style="width:100%;border-radius:8px;border:1px solid #E4DFD3;display:block;">
      </div>` : ''}

      <!-- MOOD BOARD -->
      ${moodImgs.length > 0 ? `<div style="margin-bottom:24px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:12px;font-weight:700;">Visual Reference</div>${moodboardHtml}</div>` : ''}

      <!-- LINE ITEMS TABLE -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:32px;">
        <thead>
          <tr style="border-top:1px solid #E4DFD3;border-bottom:1.5px solid #1F3D2B;">
            <th style="padding:9px 12px 9px 0;text-align:left;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#1F3D2B;font-weight:700;width:164px;">Design</th>
            <th style="padding:9px 12px;text-align:left;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#1F3D2B;font-weight:700;">Description</th>
            <th style="padding:9px 10px;text-align:center;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#1F3D2B;font-weight:700;width:44px;">Qty</th>
            <th style="padding:9px 10px;text-align:right;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#1F3D2B;font-weight:700;width:76px;">Price</th>
            <th style="padding:9px 12px 9px 10px;text-align:right;font-size:8.5px;letter-spacing:2px;text-transform:uppercase;color:#1F3D2B;font-weight:700;width:76px;">Total</th>
          </tr>
        </thead>
        <tbody>${lineItemRows || '<tr><td colspan="5" style="padding:28px;text-align:center;color:#9C9686;font-size:13px;font-style:italic;">No items added yet — go to Proposal Builder to add items.</td></tr>'}</tbody>
      </table>

      <!-- TOTALS — right-aligned, clean rule-based layout -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:36px;">
        <div style="width:300px;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;border-bottom:1px solid #E4DFD3;"><span style="color:#6B6455;">Subtotal</span><span id="pd-total-subtotal" style="font-weight:500;">${fmt(subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;border-bottom:1px solid #E4DFD3;"><span style="color:#6B6455;">Shipping (${_shipRate}%)</span><span id="pd-total-shipping">${fmt(shipping)}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;border-bottom:1px solid #E4DFD3;"><span style="color:#6B6455;">${taxLabel}</span><span id="pd-total-tax">${fmt(tax)}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0 8px;border-top:2px solid #1F3D2B;margin-top:6px;"><span style="font-family:'Playfair Display',serif;font-size:17px;font-weight:600;color:#1F3D2B;">Grand Total</span><span id="pd-total-grand" style="font-family:'Playfair Display',serif;font-size:19px;font-weight:600;color:#1F3D2B;font-variant-numeric:tabular-nums;">${fmt(total)}</span></div>
          ${_payments.length > 0 ? `
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #E4DFD3;">
            <div style="font-size:8px;text-transform:uppercase;letter-spacing:2px;color:#9C6B1F;margin-bottom:6px;font-weight:700;">Payments Received</div>
            ${_paymentRowsHtml}
            <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:11.5px;"><span style="color:#6B6455;">Total Paid</span><span style="color:#2F7D5A;font-weight:700;">${fmt(_totalPaid)}</span></div>
          </div>` : `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;font-size:12px;"><span style="color:#6B6455;">Deposit Required</span><span style="font-weight:600;">${_depositAmt > 0 ? fmt(_depositAmt) : '___________'}</span></div>`}
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0 2px;border-top:1.5px solid ${_isPaid ? '#2F7D5A' : '#9C6B1F'};margin-top:6px;">
            <span style="font-size:14px;font-weight:700;color:${_isPaid ? '#2F7D5A' : '#1F3D2B'};">${_isPaid ? '✓ Paid in Full' : 'Balance Due'}</span>
            <span style="font-size:15px;font-weight:800;color:${_isPaid ? '#2F7D5A' : '#B3261E'};">${_isPaid ? fmt(0) : fmt(balanceDue)}</span>
          </div>
        </div>
      </div>

      <!-- TERMS — left gold accent, white background -->
      <div style="border-left:3px solid #9C6B1F;padding:14px 18px;margin-bottom:32px;page-break-inside:avoid;">
        <div style="font-size:8px;text-transform:uppercase;letter-spacing:2.5px;color:#9C6B1F;margin-bottom:10px;font-weight:700;">Terms &amp; Conditions</div>
        <div style="font-size:11px;color:#4A453D;line-height:1.8;">
          <em>IF YOU WOULD LIKE TO SAVE THE DATE, PLEASE MAKE A NON-REFUNDABLE DEPOSIT OF ${_depositAmt > 0 ? fmt(_depositAmt) : "$1,000"}.</em><br><br>
          <strong>The balance must be paid in full by ${balanceDueStr}.</strong> Any changes must be finalized by ${balanceDueStr}. All rental items must be finalized by ${balanceDueStr} and returned in good condition. Any missing or damaged pieces will be charged to the client accordingly. Deposits are not refundable.<br><br>${isDC ? '<strong>Washington, DC events:</strong> Sales tax of 6% applies to the combined subtotal and shipping total per DC tax regulations.<br><br>' : ''}<span style="color:#B3261E;font-weight:600;">PLEASE NOTE ALL CREDIT AND DEBIT CARD TRANSACTIONS INCUR A 3% PROCESSING FEE.</span>
        </div>
      </div>
    </div>

    <!-- Signatures + footer print as one unit so the footer never lands alone on a page -->
    <div style="page-break-inside:avoid;break-inside:avoid;">
      <div style="padding:0 36px 28px;">

      <!-- SIGNATURES -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:52px;margin-bottom:32px;page-break-inside:avoid;">
        <div style="padding-top:40px;">
          <div style="border-top:1px solid #2A2822;padding-top:8px;"></div>
          <div style="font-size:11.5px;font-weight:700;color:#2A2822;">CLIENT: ${escapeHtml(clientName)}</div>
          <div style="font-size:9.5px;color:#9C9686;margin-top:3px;">Signature &amp; Date</div>
        </div>
        <div style="padding-top:40px;">
          <div style="border-top:1px solid #2A2822;padding-top:8px;"></div>
          <div style="font-size:11.5px;font-weight:700;color:#2A2822;">SHARONE ABARJEL / OWNER</div>
          <div style="font-size:9.5px;color:#9C9686;margin-top:3px;">Da Vinci's Florist, LLC</div>
        </div>
      </div>

    </div>

    <!-- FOOTER — subtle, ink-light -->
    <div style="border-top:1px solid #E4DFD3;padding:10px 36px;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:9px;color:#9C9686;">Da Vinci's Florist, LLC &nbsp;·&nbsp; davinciflorist.com</div>
      <div style="font-size:9px;color:#9C6B1F;letter-spacing:1px;text-transform:uppercase;font-weight:600;">Thank You</div>
    </div>
    </div>

  </div>`;

  const preview = document.getElementById('proposal-doc-preview');
  preview.style.display = 'block';
  preview.innerHTML = docHtml;
  document.getElementById('proposal-form-card').style.display = 'none';
  document.getElementById('custom-items-card').style.display = 'none';
  document.getElementById('pdf-btn').style.display = '';

  // Attach auto-save on any edit within the preview
  _propDocDirty = false;
  if (!preview._docAutoSaveAttached) {
    preview.addEventListener('input', _propDocMarkDirty);
    preview.addEventListener('blur', _propDocMarkDirty, true);
    preview._docAutoSaveAttached = true;
  }

  // Scroll to top of preview
  preview.scrollIntoView({behavior:'smooth', block:'start'});
}

function editProposalDoc() {
  document.getElementById('proposal-doc-preview').style.display = 'none';
  const form = document.getElementById('proposal-form-card');
  if (form) { form.style.display = ''; form.scrollIntoView({behavior:'smooth', block:'start'}); }
  document.getElementById('custom-items-card').style.display = '';
}

async function generatePDF() {
  const btn = document.getElementById('pdf-btn');
  btn.textContent = '⏳ Generating…';
  btn.disabled = true;

  const printContent = document.getElementById('printable-proposal');
  if (!printContent) {
    alert('Please preview the document first.');
    btn.textContent = '⬇ Download PDF';
    btn.disabled = false;
    return;
  }

  const w = window.open('', '_blank');
  const css = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; }

    /* Ensure all colors and images print faithfully */
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* Structural reset for print context */
    #printable-proposal {
      max-width: 100% !important;
      border: none !important;
      box-shadow: none !important;
      border-radius: 0 !important;
    }

    /* Hide the on-screen edit hint */
    .no-print { display: none !important; }

    /* Page break control */
    tr, .prop-doc-item { page-break-inside: avoid; break-inside: avoid; }
    thead { display: table-header-group; }
    table { page-break-inside: auto; break-inside: auto; }
    img { page-break-inside: avoid; break-inside: avoid; max-width: 100%; }

    /* Never orphan the totals or terms block */
    #printable-proposal > div > div:last-child > div { page-break-inside: avoid; }

    /* Keep an area heading with its first item */
    .prop-doc-area { page-break-after: avoid; break-after: avoid; }

    @page {
      size: letter portrait;
      margin: 0.45in 0.55in;
    }
    @media print {
      body { background: #fff !important; }
    }
  `;

  const html = [
    '<!DOCTYPE html><html><head>',
    '<meta charset="UTF-8">',
    '<title>Da Vinci\'s Florist — Event Proposal</title>',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">',
    '<style>' + css + '</style>',
    '</head><body>',
    printContent.outerHTML,
    '</body></html>'
  ].join('');

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 900);

  btn.textContent = '⬇ Download PDF';
  btn.disabled = false;
}

function propDocFieldBlur(el) {
  el.style.borderBottomColor = 'transparent';
  el.style.background = '';
  const syncId = el.dataset.sync;
  if (!syncId) return;
  const target = document.getElementById(syncId);
  if (!target) return;
  const val = el.textContent.trim();
  // If the span still shows the original placeholder text, treat it as empty
  const wasPlaceholder = val === el.dataset.placeholder || val === target.placeholder;
  if (wasPlaceholder || !val) {
    target.value = '';
    // Restore red-placeholder styling
    el.style.color = '#B3261E';
    el.style.fontStyle = 'italic';
  } else {
    target.value = val;
    el.style.color = '';
    el.style.fontStyle = '';
  }
  el.style.borderBottom = '1px dashed transparent';
  _propDocMarkDirty();
}

// ── PROPOSAL PREVIEW INLINE EDITING + SAVE ───────────────────────────────────
let _propDocDirty = false;
let _propDocAutoSaveTimer = null;
let _propDocSaveFlashTimer = null;

function _propDocMarkDirty() {
  _propDocDirty = true;
  clearTimeout(_propDocAutoSaveTimer);
  _propDocAutoSaveTimer = setTimeout(() => {
    if (_propDocDirty && proposalItems.length) propDocSave();
  }, 3000);
}

function propDocSave() {
  _propMergeCustomLineItems();
  if (!proposalItems.length) { showToast('No items to save', 'toast-info'); return; }
  // Sync pd-* form fields back to prop-* so propSave() picks them up
  const docMap = [
    ['pd-client','prop-client'], ['pd-child','prop-child'],
    ['pd-phone','prop-phone'],   ['pd-email','prop-email'],
    ['pd-venue','prop-venue'],   ['pd-date','prop-date'],
    ['pd-theme','prop-colors'],  ['pd-planner','prop-planner'],
    ['pd-notes','prop-notes'],   ['pd-adults','prop-adults'],
    ['pd-kids','prop-kids'],     ['pd-pickup','prop-pickup'],
  ];
  docMap.forEach(([src, dst]) => {
    const s = document.getElementById(src), d = document.getElementById(dst);
    if (s && d && s.value) d.value = s.value;
  });
  propSave();
  _propDocDirty = false;
  clearTimeout(_propDocAutoSaveTimer);
  renderProposalDoc(); // reflects merged custom line items now sourced from proposalItems
  // Flash indicator
  const ind = document.getElementById('prop-doc-save-indicator');
  if (ind) {
    ind.textContent = '✓ Saved';
    ind.style.opacity = '1';
    clearTimeout(_propDocSaveFlashTimer);
    _propDocSaveFlashTimer = setTimeout(() => { ind.style.opacity = '0'; }, 2200);
  }
}

function propDocItemBlur(el) {
  el.style.background = '';
  const idx = parseInt(el.dataset.propIdx);
  const field = el.dataset.propField;
  if (isNaN(idx) || idx < 0 || idx >= proposalItems.length) return;
  const item = proposalItems[idx];
  const val = el.textContent.trim();

  if (field === 'name') {
    if (val) item.name = val;
    else el.textContent = item.name;
  } else if (field === 'notes') {
    item.notes = val;
  } else if (field === 'qty') {
    const q = Math.max(1, parseInt(val) || 1);
    item.qty = q;
    el.textContent = q;
    _propDocUpdateTotals();
  } else if (field === 'price') {
    const raw = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (!isNaN(raw) && raw > 0) {
      item.price = '$' + raw.toFixed(2);
    }
    const p = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
    el.textContent = p > 0 ? fmt(p) : '—';
    _propDocUpdateTotals();
  }

  // Update item row total cell
  const p = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
  const rowTotal = document.getElementById('pd-item-total-' + idx);
  if (rowTotal) rowTotal.textContent = p > 0 ? fmt(p * (item.qty || 1)) : '—';

  _propDocMarkDirty();
}

function _propDocUpdateTotals() {
  const lineItems = getProposalLineItems();
  const subtotal = lineItems.reduce((a, b) => a + b.total, 0);
  const _shipRate = parseFloat((document.getElementById('prop-ship-rate') || {value:'20'}).value) || 20;
  const _taxRate  = parseFloat((document.getElementById('prop-tax-rate')  || {value:'6'}).value)  || 6;
  const shipping  = subtotal * (_shipRate / 100);
  const tax       = (subtotal + shipping) * (_taxRate / 100);
  const total     = subtotal + shipping + tax;
  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmt(v); };
  setT('pd-total-subtotal', subtotal);
  setT('pd-total-shipping', shipping);
  setT('pd-total-tax', tax);
  setT('pd-total-grand', total);
}
