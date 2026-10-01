// App shell: desktop icon rail (hover/focus expands it; the toggle pins it open)
// and the phone drawer (menu button and the "More" tab open it).

const RAIL_PINNED_KEY = 'efRailPinned';

function shellInit() {
  let pinned = false;
  try { pinned = localStorage.getItem(RAIL_PINNED_KEY) === '1'; } catch (e) {}
  _shellSetRail(pinned);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.documentElement.classList.contains('nav-open')) shellCloseNav();
  });
}

function _shellSetRail(pinned) {
  document.documentElement.classList.toggle('rail-pinned', pinned);
  const btn = document.querySelector('.rail-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(pinned));
  btn.querySelector('use').setAttribute('href', pinned ? '#i-panel-left-close' : '#i-panel-left-open');
  btn.querySelector('.nav-label').textContent = pinned ? 'Collapse sidebar' : 'Keep sidebar open';
}

function shellToggleRail() {
  const pinned = !document.documentElement.classList.contains('rail-pinned');
  _shellSetRail(pinned);
  try { localStorage.setItem(RAIL_PINNED_KEY, pinned ? '1' : '0'); } catch (e) {}
}

function shellOpenNav() {
  document.documentElement.classList.add('nav-open');
  document.querySelectorAll('[aria-controls="app-sidebar"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
  const current = document.querySelector('#app-sidebar .nav-item.active') || document.querySelector('#app-sidebar .nav-item');
  if (current) current.focus();
}

function shellCloseNav() {
  const root = document.documentElement;
  if (!root.classList.contains('nav-open')) return;
  const hadFocus = document.getElementById('app-sidebar').contains(document.activeElement);
  root.classList.remove('nav-open');
  document.querySelectorAll('[aria-controls="app-sidebar"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  if (hadFocus) document.activeElement.blur();
}
