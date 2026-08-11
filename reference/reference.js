/**
 * reference.js — LabValues Helper full reference page script
 * Renders categorized, searchable table of all lab values.
 */

'use strict';

let labData = [];
let activeCategory = 'all';

const refSearch = document.getElementById('ref-search');
const categoryNav = document.getElementById('category-nav');
const refMain = document.getElementById('ref-main');
const statsCount = document.getElementById('stats-count');

// ── Category icons map ─────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  'CBC': '🩸',
  'BMP/CMP': '⚗️',
  'LFT': '🫁',
  'Lipid Panel': '💧',
  'Thyroid': '🦋',
  'Coagulation': '🧪',
  'ABG': '🫀',
  'Diabetes': '🍬',
  'Iron Studies': '🔩',
  'Cardiac Markers': '❤️',
  'Inflammatory Markers': '🔥',
  'Pancreatic': '🧫',
  'Vitamins': '💊',
  'Urinalysis': '🧴',
  'Others': '📋',
};

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const url = chrome.runtime.getURL('data/lab-values.json');
  const res = await fetch(url);
  labData = await res.json();

  buildCategoryNav();
  render();

  statsCount.textContent = `${labData.length} lab values`;
}

// ── Build category navigation ──────────────────────────────────────────────
function buildCategoryNav() {
  const cats = [...new Set(labData.map(l => l.category))];

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.dataset.cat = cat;
    const icon = CATEGORY_ICONS[cat] || '📋';
    btn.textContent = `${icon} ${cat}`;
    btn.addEventListener('click', () => {
      setActiveCategory(cat);
    });
    categoryNav.appendChild(btn);
  });

  // "All" button already in HTML — wire it up
  document.querySelector('.cat-btn[data-cat="all"]').addEventListener('click', () => {
    setActiveCategory('all');
  });
}

function setActiveCategory(cat) {
  activeCategory = cat;
  // Update button states
  document.querySelectorAll('.cat-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  render();
}

// ── Render ─────────────────────────────────────────────────────────────────
function render() {
  const query = refSearch.value.trim().toLowerCase();

  // Filter labs
  let filtered = labData;
  if (query) {
    filtered = labData.filter(lab => {
      if (lab.name.toLowerCase().includes(query)) return true;
      if (lab.id.toLowerCase().includes(query)) return true;
      if (lab.category.toLowerCase().includes(query)) return true;
      if (lab.notes && lab.notes.toLowerCase().includes(query)) return true;
      return lab.aliases.some(a => a.toLowerCase().includes(query));
    });
  }

  if (activeCategory !== 'all') {
    filtered = filtered.filter(l => l.category === activeCategory);
  }

  if (filtered.length === 0) {
    refMain.innerHTML = '<div class="no-results">No lab values match your search.</div>';
    return;
  }

  // Group by category
  const grouped = {};
  filtered.forEach(lab => {
    if (!grouped[lab.category]) grouped[lab.category] = [];
    grouped[lab.category].push(lab);
  });

  refMain.innerHTML = Object.entries(grouped).map(([cat, labs]) => {
    const icon = CATEGORY_ICONS[cat] || '📋';
    return `
      <section class="category-section">
        <h2 class="category-heading">
          ${icon} ${escHtml(cat)}
          <span class="category-count">${labs.length} test${labs.length !== 1 ? 's' : ''}</span>
        </h2>
        <table class="lab-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Aliases / Abbreviations</th>
              <th>Reference Ranges</th>
              <th>SI Range</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${labs.map(lab => buildRow(lab)).join('')}
          </tbody>
        </table>
      </section>`;
  }).join('');
}

function buildRow(lab) {
  const aliasesHtml = lab.aliases
    .map(a => `<span>${escHtml(a)}</span>`)
    .join('');

  const rangesHtml = lab.ranges.map(r => {
    let valueStr;
    if (r.low === null || (r.low === 0 && r.high === 0)) {
      valueStr = r.high !== null ? `< ${r.high} ${escHtml(r.unit)}` : 'Negative';
    } else if (r.high === null) {
      valueStr = `≥ ${r.low} ${escHtml(r.unit)}`;
    } else {
      valueStr = `${r.low}–${r.high} ${escHtml(r.unit)}`;
    }
    return `
      <div class="td-range-row">
        <span class="td-population">${escHtml(r.population)}</span>
        <span class="td-value">${valueStr}</span>
      </div>`;
  }).join('');

  return `
    <tr>
      <td class="td-name">${escHtml(lab.name)}</td>
      <td class="td-aliases">${aliasesHtml}</td>
      <td class="td-ranges">${rangesHtml}</td>
      <td class="td-si">${escHtml(lab.siRange || '—')}</td>
      <td class="td-notes">${escHtml(lab.notes || '')}</td>
    </tr>`;
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Search ─────────────────────────────────────────────────────────────────
let searchDebounce = null;
refSearch.addEventListener('input', () => {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(render, 200);
});

// ── Start ──────────────────────────────────────────────────────────────────
init().catch(err => console.warn('[LabValues Helper] Reference page error:', err));
