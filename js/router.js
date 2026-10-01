// Screen switching: navigate(page) toggles #section-<page>.active and the sidebar highlight.

const pages = {
  dashboard: 'Dashboard',
  pipeline: 'Event Pipeline',
  'my-proposals': 'My Proposals',
  'proposal-doc': 'Proposal Document',
  proposals: 'Proposal Builder',
  inventory: 'Inventory',
  availability: 'Availability',
  clients: 'Clients & CRM',
  contracts: 'Contracts',
  invoices: 'Invoices & Payments',
  visualizer: 'Venue Visualizer'
};

let _currentPage = '';

function navigate(page) {
  // Warn if leaving proposal-doc with unsaved inline edits
  if (_currentPage === 'proposal-doc' && page !== 'proposal-doc' && _propDocDirty) {
    if (confirm('You have unsaved changes on the proposal preview — save before leaving?')) {
      propDocSave();
    }
  }
  // Flush pending viz save before leaving the page
  if (_currentPage === 'visualizer' && page !== 'visualizer' && typeof _vizDoSave === 'function') {
    clearTimeout(_vizSaveTimer); _vizDoSave();
  }
  _currentPage = page;
  if (page === 'proposals') {
    if (!propInvBuilt) setTimeout(propBuildInventory, 80);
    setTimeout(_propRestoreDraft, 300);
    // Auto-save draft on every field change
    const propSec = document.getElementById('section-proposals');
    if (propSec && !propSec._autoSaveAttached) {
      propSec.addEventListener('input', _propScheduleDraft);
      propSec.addEventListener('change', _propScheduleDraft);
      propSec._autoSaveAttached = true;
    }
  }
  if (page === 'my-proposals') { setTimeout(renderMyProposals, 50); }
  if (page === 'clients')      { setTimeout(_crmRestoreFilter, 50); }
  if (page === 'dashboard')    { setTimeout(renderDashboard, 50); }
  if (page === 'visualizer')   { setTimeout(vizInit, 80); }
  if (page === 'contracts')    { setTimeout(_contractsRestoreTemplate, 50); }
  if (page === 'pipeline')     { setTimeout(_pipelineRefreshCounts, 50); }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('section-' + page);
  if (sec) sec.classList.add('active');
  document.getElementById('page-title').textContent = pages[page] || page;
  document.querySelectorAll('.nav-item').forEach(n => {
    const oc = n.getAttribute('onclick') || '';
    const dataPage = n.dataset.page || '';
    const matches = oc.includes("'" + page + "'")
      || dataPage === page
      || (page === 'proposals' && (oc.includes('propNewBlank') || oc.includes("navigate('proposals')")));
    if (matches) n.classList.add('active');
  });
  if (page === 'availability') renderCalendar();
}
