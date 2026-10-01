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
  if (e.key === 'Escape') {
    document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
    const overlay = document.getElementById('modal-overlay');
    if (overlay && overlay.classList.contains('open')) closeModal();
  }
});

// Close open inv overlays when clicking outside any card
document.addEventListener('click', e => {
  if (!e.target.closest('.inv-card')) {
    document.querySelectorAll('.inv-edit-overlay.open').forEach(o => o.classList.remove('open'));
  }
});

// ── Page Init ────────────────────────────────────────────────────────────────
renderCalendar();
renderDashboard();
_pipelineRefreshCounts();
