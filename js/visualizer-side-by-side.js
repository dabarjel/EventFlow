// Venue Visualizer: Side-by-side view.

// ══════════════════════════════════════════════════════════════════════════════
// ── FEATURE 2: SIDE BY SIDE VIEW ─────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

let _vizSplitActive = false;
let _vzaSplitDragging = false;
let _vzaSplitDragStartX = 0;
let _vzaSplitDragStartW = 0;

function vizToggleSplit() {
  _vizSplitActive = !_vizSplitActive;
  const vizSec = document.getElementById('section-visualizer');
  const btn = document.getElementById('viz-split-btn');
  if (vizSec) vizSec.classList.toggle('viz-split-active', _vizSplitActive);
  if (btn) btn.classList.toggle('active', _vizSplitActive);
  if (_vizSplitActive) {
    vizShowStage('analyze');
    vizSplitRender();
  }
}

function vizSplitRender() {
  const right = document.getElementById('viz-split-right');
  if (!right || !_vizSplitActive) return;
  const itemsDiv  = document.getElementById('viz-split-prop-items');
  const totalDiv  = document.getElementById('viz-split-prop-total');
  const countSpan = document.getElementById('viz-split-item-count');
  if (!itemsDiv || !totalDiv) return;

  if (countSpan) countSpan.textContent = proposalItems.length ? proposalItems.length + ' item' + (proposalItems.length !== 1 ? 's' : '') : '';

  if (!proposalItems.length) {
    itemsDiv.innerHTML = '<div class="viz-split-empty">No items yet.<br>Add items from the left panel.</div>';
    totalDiv.innerHTML = '';
    return;
  }

  itemsDiv.innerHTML = '';
  let subTotal = 0;
  proposalItems.forEach(item => {
    const p = parseFloat((item.price || '').replace(/[^0-9.]/g, '')) || 0;
    subTotal += p * (item.qty || 1);

    const row = document.createElement('div');
    row.className = 'viz-split-item'; row.id = 'vsplit-' + item.id;

    if (item.imgSrc) {
      const img = document.createElement('img');
      img.className = 'viz-split-item-img'; img.src = item.imgSrc; img.alt = item.name;
      row.appendChild(img);
    } else {
      const ph = document.createElement('div'); ph.className = 'viz-split-item-ph'; ph.textContent = '📦';
      row.appendChild(ph);
    }

    const body = document.createElement('div'); body.className = 'viz-split-item-body';
    const nameEl = document.createElement('div'); nameEl.className = 'viz-split-item-name'; nameEl.textContent = item.name;
    body.appendChild(nameEl);

    const r2 = document.createElement('div'); r2.className = 'viz-split-item-row';
    const qtyIn = document.createElement('input');
    qtyIn.type = 'number'; qtyIn.className = 'viz-split-qty'; qtyIn.value = item.qty || 1; qtyIn.min = 1;
    qtyIn.addEventListener('change', () => { item.qty = Math.max(1, parseInt(qtyIn.value) || 1); propUpdateTotals(); vizSplitRender(); _propScheduleDraft(); });
    const priceEl = document.createElement('span'); priceEl.className = 'viz-split-price'; priceEl.textContent = item.price || 'MP';
    const removeBtn = document.createElement('button'); removeBtn.className = 'viz-split-remove'; removeBtn.textContent = '×';
    removeBtn.onclick = () => { propRemove(item.id); };
    r2.appendChild(qtyIn); r2.appendChild(priceEl); r2.appendChild(removeBtn);
    body.appendChild(r2); row.appendChild(body); itemsDiv.appendChild(row);
  });

  totalDiv.innerHTML = `<div class="viz-split-total-row"><span>Subtotal</span><span>$${subTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>`;
}

// Flash animation on newly added split item
function _vizSplitFlash(itemId) {
  setTimeout(() => {
    const row = document.getElementById('vsplit-' + itemId);
    if (row) { row.classList.add('viz-add-flash'); setTimeout(() => row.classList.remove('viz-add-flash'), 600); }
  }, 50);
}

// Draggable divider
function vzaSplitStartDrag(e) {
  e.preventDefault();
  const right = document.getElementById('viz-split-right');
  const divider = document.getElementById('viz-split-divider');
  if (!right) return;
  _vzaSplitDragging = true;
  _vzaSplitDragStartX = e.clientX;
  _vzaSplitDragStartW = right.offsetWidth;
  if (divider) divider.classList.add('dragging');
  document.addEventListener('mousemove', _vzaSplitOnDrag);
  document.addEventListener('mouseup', _vzaSplitEndDrag);
}
function _vzaSplitOnDrag(e) {
  if (!_vzaSplitDragging) return;
  const right = document.getElementById('viz-split-right');
  if (!right) return;
  const dx = _vzaSplitDragStartX - e.clientX;
  const newW = Math.max(200, Math.min(700, _vzaSplitDragStartW + dx));
  right.style.width = newW + 'px';
}
function _vzaSplitEndDrag() {
  _vzaSplitDragging = false;
  const divider = document.getElementById('viz-split-divider');
  if (divider) divider.classList.remove('dragging');
  document.removeEventListener('mousemove', _vzaSplitOnDrag);
  document.removeEventListener('mouseup', _vzaSplitEndDrag);
}
