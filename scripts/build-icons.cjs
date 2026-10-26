// Rebuilds the Lucide sprite in index.html (between ICONS:START and ICONS:END).
// Dev-only; the app itself has no build step.
//
//   npm install --prefix <tmp dir> lucide-static@1.49.0
//   node scripts/build-icons.cjs <tmp dir>/node_modules/lucide-static
//
// To add an icon, add its Lucide name to ICONS and rerun. Use it in markup as
// <svg class="icon" aria-hidden="true"><use href="#i-NAME"/></svg>, or iconSvg('NAME') in JS.
const fs = require('fs');
const path = require('path');

const ICONS = [
  // App shell
  'calendar-days', 'camera', 'ellipsis', 'file-pen-line', 'file-plus', 'files', 'house', 'kanban',
  'layout-dashboard', 'log-out', 'menu', 'package', 'panel-left-close', 'panel-left-open', 'plus',
  'receipt', 'users', 'x',
  // Proposal builder
  'check', 'chevron-left', 'chevron-right', 'eye', 'folder-open', 'grid-2x2', 'grid-3x3', 'minus',
  'package-plus', 'paperclip', 'save', 'scan-eye', 'search', 'trash-2',
  // Catalog category placeholders
  'armchair', 'drama', 'flame', 'flower', 'flower-2', 'layers', 'lightbulb', 'martini', 'music',
  'rectangle-horizontal', 'sofa', 'sparkles', 'tent', 'utensils',
];

const pkg = process.argv[2];
if (!pkg) { console.error('Usage: node scripts/build-icons.cjs <path to lucide-static>'); process.exit(1); }
const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;

const symbols = [...new Set(ICONS)].sort().map(name => {
  const svg = fs.readFileSync(path.join(pkg, 'icons', name + '.svg'), 'utf8');
  const inner = svg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>[\s\S]*$/, '')
    .split('\n').map(l => l.trim()).filter(Boolean).join('')
    .replace(/\s*\/>/g, '/>');
  return `  <symbol id="i-${name}" viewBox="0 0 24 24">${inner}</symbol>`;
});

const block = [
  `<!-- ICONS:START: Lucide v${version} (ISC, lucide.dev). Regenerate, don't hand-edit. -->`,
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">',
  ...symbols,
  '</svg>',
  '<!-- ICONS:END -->',
].join('\n');

const file = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(file, 'utf8');
const re = /<!-- ICONS:START[\s\S]*?<!-- ICONS:END -->/;
if (!re.test(html)) { console.error('ICONS:START/END markers not found in index.html'); process.exit(1); }
fs.writeFileSync(file, html.replace(re, block));
console.log(`Wrote ${symbols.length} icons (lucide-static ${version}) to index.html`);
