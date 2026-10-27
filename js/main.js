// Boot: runs after every other script has defined its functions. Kick-off calls were
// moved here (same order as before) so no async work starts until everything exists.

shellInit();
_authInit();

// ── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Ctrl/Cmd + S → save proposal when in builder
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    const active = document.querySelector('.section.active');
    if (active && active.id === 'section-proposals') {
      e.preventDefault();
      propSave();
      return;
    }
  }
  // Dropdown menus: Escape closes and returns focus to the button; arrows move between items
  const openMenu = document.querySelector('.menu:not([hidden])');
  if (openMenu && e.key === 'Escape') {
    const btn = document.querySelector('[aria-controls="' + openMenu.id + '"]');
    menuCloseAll();
    if (btn) btn.focus();
    return;
  }
  if (openMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    const items = [...openMenu.querySelectorAll('.menu-item')];
    const i = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    e.preventDefault();
    items[next].focus();
    return;
  }
  if (e.key === 'Escape') {
    document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.classList.contains('open')) closeModal();
  }
});

// Close open inv overlays when clicking outside any card
document.addEventListener('click', e => {
  // Dropdown menus close after an item runs, or on a click outside them
  if (e.target.closest('.menu .menu-item') || !e.target.closest('.menu-wrap')) menuCloseAll();
  if (!e.target.closest('.inv-card')) {
    document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
  }
});

// Tabbing out of a dropdown menu closes it
document.addEventListener('focusin', e => {
  if (!e.target.closest('.menu-wrap')) menuCloseAll();
});

// ── Page Init ────────────────────────────────────────────────────────────────
renderCalendar();
renderDashboard();
_pipelineRefreshCounts();
