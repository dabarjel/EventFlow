// Shared modal (#modal-overlay) and its form templates.

// MODAL
const modals = {
  'new-event': `<div class="modal-title">New Event</div>
    <div class="form-grid-2">
      <div class="client-field"><label>Client Name</label><input id="ne-client" placeholder="Full name"></div>
      <div class="client-field"><label>Event Type</label><select id="ne-type"><option>Wedding</option><option>Corporate</option><option>Birthday</option><option>Anniversary</option><option>Bat/Bar Mitzvah</option><option>Other</option></select></div>
    </div>
    <div class="form-grid-2">
      <div class="client-field"><label>Event Date</label><input type="date" id="ne-date"></div>
      <div class="client-field"><label>Guest Count</label><input type="number" id="ne-guests" placeholder="100"></div>
    </div>
    <div class="form-grid-2">
      <div class="client-field"><label>Venue</label><input id="ne-venue" placeholder="Venue name"></div>
      <div class="client-field"><label>Est. Value</label><input id="ne-value" placeholder="$5,000"></div>
    </div>
    <div class="form-grid-2">
      <div class="client-field"><label>Email</label><input id="ne-email" placeholder="client@email.com"></div>
      <div class="client-field"><label>Phone</label><input id="ne-phone" placeholder="(301) 555-0000"></div>
    </div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createNewEvent()">Create Event</button></div>`,
  'event-detail': `<div class="modal-title" id="ed-title">Event Detail</div>
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap;">
      <span class="badge badge-active" id="ed-badge" style="font-size:var(--fs-xs);padding:5px 12px;">Active</span>
      <span style="font-size:var(--fs-sm);color:var(--text-3);" id="ed-meta"></span>
    </div>
    <div class="detail-row"><span class="detail-label">Est. Value</span><span id="ed-value" style="font-weight:var(--weight-medium);color:var(--text);">—</span></div>
    <div class="modal-actions" style="margin-top:20px;">
      <button class="btn" onclick="closeModal()">Close</button>
      <button class="btn" onclick="propNewBlank();closeModal()" title="Start a new proposal for this event">+ New Proposal</button>
      <button class="btn btn-primary" onclick="navigate('my-proposals');closeModal()">My Proposals →</button>
    </div>`,
  'new-client': `<div class="modal-title">Add New Client</div>
    <div class="form-grid-2">
      <div class="client-field"><label>First Name</label><input id="nc-first" placeholder="Jane"></div>
      <div class="client-field"><label>Last Name</label><input id="nc-last" placeholder="Smith"></div>
    </div>
    <div class="client-field"><label>Email</label><input id="nc-email" placeholder="jane@email.com"></div>
    <div class="client-field"><label>Phone</label><input id="nc-phone" placeholder="(555) 000-0000"></div>
    <div class="client-field"><label>How did they find you?</label><select id="nc-source"><option>Referral</option><option>Instagram</option><option>Google</option><option>Wedding Wire</option><option>The Knot</option></select></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="crmAddClientFromModal()">Add Client</button></div>`,
  'add-item': `<div class="modal-title">Add Inventory Item</div>
    <div class="client-field"><label>Item Name <span style="color:var(--danger-text);">*</span></label><input id="new-item-name" placeholder="e.g. Chiavari Chair — Gold" autocomplete="off"></div>
    <div class="form-grid-2">
      <div class="client-field"><label>Category</label>
        <select id="new-item-cat">
          <option>Seating</option><option>Tables</option><option>Linens &amp; Draping</option>
          <option>Décor &amp; Props</option><option>Bars &amp; Displays</option><option>Tableware</option>
          <option>Lighting</option><option>Lounge Furniture</option><option>Flooring &amp; Staging</option>
          <option>Tents &amp; Structures</option><option>Other</option>
        </select>
      </div>
      <div class="client-field"><label>Price per unit (blank = Market Price)</label><input id="new-item-price" type="number" min="0" step="1" placeholder="e.g. 25"></div>
    </div>
    <div class="client-field"><label>Notes / Description</label><textarea id="new-item-notes" rows="2" placeholder="Color, size, storage location, condition…"></textarea></div>
    <div class="client-field"><label>Photo (optional)</label><input id="new-item-img" type="file" accept="image/*" style="font-size:var(--fs-xs);" onchange="_newItemHandleImg(this)"><div id="new-item-img-name" style="font-size:var(--fs-2xs);color:var(--text-3);margin-top:3px;"></div></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="addInvItemFromModal()">Add to Inventory</button></div>`,
  'new-contract': `<div class="modal-title">New Contract</div>
    <div class="client-field"><label>Client</label><select><option>Sarah Thompson</option><option>Azure Tech Corp</option><option>Robert Hargrove</option></select></div>
    <div class="client-field"><label>Template</label><select><option>Standard Wedding Agreement</option><option>Corporate Event Agreement</option><option>Social Event Agreement</option></select></div>
    <div class="form-grid-2">
      <div class="client-field"><label>Contract Date</label><input type="date"></div>
      <div class="client-field"><label>Event Date</label><input type="date"></div>
    </div>
    <div class="client-field"><label>Deposit %</label><input type="number" placeholder="50" value="50"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Contract generation coming in a future update','toast-info');closeModal()">Generate Contract</button></div>`,
  'new-invoice': `<div class="modal-title">New Invoice</div>
    <div class="client-field"><label>Client</label><select><option>Sarah Thompson</option><option>Azure Tech Corp</option><option>Robert Hargrove</option></select></div>
    <div class="form-grid-2">
      <div class="client-field"><label>Issue Date</label><input type="date"></div>
      <div class="client-field"><label>Due Date</label><input type="date"></div>
    </div>
    <div class="client-field"><label>Link to Proposal</label><select><option>None</option><option>Thompson–Reyes Proposal ($22,400)</option><option>Azure Tech Proposal ($14,600)</option></select></div>
    <div class="form-grid-2">
      <div class="client-field"><label>Deposit %</label><input type="number" value="50"></div>
      <div class="client-field"><label>Tax %</label><input type="number" value="8"></div>
    </div>
    <div class="client-field"><label>Notes</label><textarea rows="2" placeholder="Payment instructions, special notes…"></textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="showToast('Invoice creation coming in a future update','toast-info');closeModal()">Create Invoice</button></div>`,
};
function openModal(type) {
  document.getElementById('modal-content').innerHTML = modals[type] || '<div style="padding:20px;text-align:center;color:var(--text-3);">Content coming soon.</div>';
  document.getElementById('modal-overlay').classList.add('open');
  // Focus the first input/select so the user can start typing immediately
  setTimeout(() => {
    const first = document.querySelector('#modal-content input, #modal-content select, #modal-content textarea');
    if (first) first.focus();
  }, 60);
}
function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}
