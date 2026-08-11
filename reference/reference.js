'use strict';

let labData = [];
let activeCategory = 'all';
let unitSystem = 'conventional';
let searchDebounce = null;

const refSearch = document.getElementById('ref-search');
const categoryNav = document.getElementById('category-nav');
const refMain = document.getElementById('ref-main');
const statsCount = document.getElementById('stats-count');
const unitRadios = document.querySelectorAll('input[name="refUnit"]');

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
  'Others': '📋'
};

async function init() {
  const url = chrome.runtime.getURL('data/lab-values.json');
  const res = await fetch(url);
  labData = await res.json();

  const stored = await chrome.storage.local.get(['settings.unitSystem']);
  unitSystem = stored['settings.unitSystem'] || 'conventional';
  unitRadios.forEach(radio => {
    radio.checked = radio.value === unitSystem;
  });

  buildCategoryNav();
  bindEvents();
  render();
}

function bindEvents() {
  refSearch.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(render, 150);
  });

  unitRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) {
        return;
      }
      unitSystem = radio.value;
      chrome.storage.local.set({ 'settings.unitSystem': unitSystem });
      render();
    });
  });
}

function buildCategoryNav() {
  const allButton = categoryNav.querySelector('[data-cat="all"]');
  allButton.addEventListener('click', () => setActiveCategory('all'));

  const categories = [...new Set(labData.map(lab => lab.category))];
  categories.forEach(category => {
    const button = document.createElement('button');
    button.className = 'cat-btn';
    button.dataset.cat = category;
    button.textContent = `${CATEGORY_ICONS[category] || '📋'} ${category}`;
    button.addEventListener('click', () => setActiveCategory(category));
    categoryNav.appendChild(button);
  });
}

function setActiveCategory(category) {
  activeCategory = category;
  document.querySelectorAll('.cat-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.cat === category);
  });
  render();
}

function getRanges(lab) {
  if (lab.ranges && typeof lab.ranges === 'object' && !Array.isArray(lab.ranges)) {
    return unitSystem === 'si' && lab.ranges.si ? lab.ranges.si : lab.ranges.conventional;
  }
  return lab.ranges || [];
}

function render() {
  const query = refSearch.value.trim().toLowerCase();
  let filtered = labData.filter(lab => {
    if (!query) {
      return true;
    }
    return lab.name.toLowerCase().includes(query) ||
      lab.id.toLowerCase().includes(query) ||
      lab.category.toLowerCase().includes(query) ||
      (lab.notes || '').toLowerCase().includes(query) ||
      (lab.aliases || []).some(alias => alias.toLowerCase().includes(query));
  });

  if (activeCategory !== 'all') {
    filtered = filtered.filter(lab => lab.category === activeCategory);
  }

  statsCount.textContent = `${filtered.length} lab values · ${unitSystem === 'si' ? 'SI' : 'Conventional'} units`;

  if (filtered.length === 0) {
    refMain.innerHTML = '<div class="no-results">No lab values match your search.</div>';
    return;
  }

  const grouped = filtered.reduce((acc, lab) => {
    (acc[lab.category] ||= []).push(lab);
    return acc;
  }, {});

  refMain.innerHTML = Object.entries(grouped).map(([category, labs]) => `
    <section class="category-section">
      <h2 class="category-heading">
        ${CATEGORY_ICONS[category] || '📋'} ${escHtml(category)}
        <span class="category-count">${labs.length} test${labs.length === 1 ? '' : 's'}</span>
      </h2>
      <table class="lab-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Aliases / Abbreviations</th>
            <th>${unitSystem === 'si' ? 'SI Reference Ranges' : 'Conventional Reference Ranges'}</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          ${labs.map(buildRow).join('')}
        </tbody>
      </table>
    </section>
  `).join('');
}

function buildRow(lab) {
  const aliasesHtml = (lab.aliases || []).map(alias => `<span>${escHtml(alias)}</span>`).join('');
  const rangesHtml = getRanges(lab).map(range => {
    return `
      <div class="td-range-row">
        <span class="td-population">${escHtml(range.population)}</span>
        <span class="td-value">${formatRangeValue(range)}</span>
      </div>`;
  }).join('');

  const noteParts = [];
  if (lab.notes) {
    noteParts.push(`<div>${escHtml(lab.notes)}</div>`);
  }
  if (lab.conversionNote) {
    noteParts.push(`<div class="td-conversion">${escHtml(lab.conversionNote)}</div>`);
  }

  return `
    <tr>
      <td class="td-name">${escHtml(lab.name)}</td>
      <td class="td-aliases">${aliasesHtml}</td>
      <td class="td-ranges">${rangesHtml}</td>
      <td class="td-notes">${noteParts.join('')}</td>
    </tr>`;
}

function escHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatRangeValue(range) {
  const unit = escHtml(range.unit);
  if (range.low === null || range.low === undefined) {
    return range.high !== null && range.high !== undefined ? `&lt; ${escHtml(range.high)} ${unit}` : 'Negative';
  }
  if (range.high === null || range.high === undefined) {
    return `&ge; ${escHtml(range.low)} ${unit}`;
  }
  return `${escHtml(range.low)}–${escHtml(range.high)} ${unit}`;
}

init().catch(err => console.warn('[LabValues Helper] Reference page error:', err));
