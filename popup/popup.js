'use strict';

let labData = [];
let currentUnitSystem = 'conventional';
let currentTab = 'page';
let searchDebounce = null;

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const pageLabsList = document.getElementById('page-labs-list');
const rescanBtn = document.getElementById('rescan-btn');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');
const highlightToggle = document.getElementById('highlight-toggle');
const tooltipToggle = document.getElementById('tooltip-toggle');
const unitRadios = document.querySelectorAll('input[name="unitSystem"]');
const openRefBtn = document.getElementById('open-reference');

async function init() {
  const url = chrome.runtime.getURL('data/lab-values.json');
  const res = await fetch(url);
  labData = await res.json();

  const stored = await chrome.storage.local.get([
    'lastTab',
    'settings.unitSystem',
    'settings.autoHighlight',
    'settings.showTooltips'
  ]);

  currentUnitSystem = stored['settings.unitSystem'] || 'conventional';
  const autoHighlight = stored['settings.autoHighlight'] !== undefined ? stored['settings.autoHighlight'] : true;
  const showTooltips = stored['settings.showTooltips'] !== undefined ? stored['settings.showTooltips'] : true;

  unitRadios.forEach(radio => {
    radio.checked = radio.value === currentUnitSystem;
  });
  highlightToggle.checked = autoHighlight;
  tooltipToggle.checked = showTooltips;

  switchTab(stored.lastTab || 'page');
  loadPageLabs();
}

function switchTab(tabId) {
  currentTab = tabId;
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
  tabContents.forEach(content => content.classList.toggle('active', content.id === `tab-${tabId}`));
  chrome.storage.local.set({ lastTab: tabId });
}

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function loadPageLabs() {
  pageLabsList.innerHTML = '<p class="empty-state">Scanning page…</p>';
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) {
      pageLabsList.innerHTML = '<p class="empty-state">No active tab found.</p>';
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: 'getDetectedLabs' }, response => {
      if (chrome.runtime.lastError || !response) {
        pageLabsList.innerHTML = '<p class="empty-state">Could not read page. Try refreshing the page first.</p>';
        return;
      }

      const labs = response.labs || [];
      if (labs.length === 0) {
        pageLabsList.innerHTML = '<p class="empty-state">No lab values detected on this page.<br>Try Search mode or open a medical article.</p>';
        return;
      }

      pageLabsList.innerHTML = labs.map(buildLabCardHtml).join('');
    });
  });
}

rescanBtn.addEventListener('click', loadPageLabs);

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  clearSearchBtn.style.display = query ? 'block' : 'none';
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => runSearch(query), 150);
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  searchResults.innerHTML = '<p class="empty-state muted">Start typing a lab name (e.g., HbA1c, sodium, WBC)…</p>';
  searchInput.focus();
});

function runSearch(query) {
  if (!query) {
    searchResults.innerHTML = '<p class="empty-state muted">Start typing a lab name (e.g., HbA1c, sodium, WBC)…</p>';
    return;
  }

  const lower = query.toLowerCase();
  const matches = labData.filter(lab =>
    lab.name.toLowerCase().includes(lower) ||
    lab.id.toLowerCase().includes(lower) ||
    (lab.aliases || []).some(alias => alias.toLowerCase().includes(lower))
  );

  if (matches.length === 0) {
    searchResults.innerHTML = '<p class="empty-state">No matching lab value found.</p>';
    return;
  }

  searchResults.innerHTML = matches.map(buildLabCardHtml).join('');
}

unitRadios.forEach(radio => {
  radio.addEventListener('change', () => {
    if (!radio.checked) {
      return;
    }

    currentUnitSystem = radio.value;
    chrome.storage.local.set({ 'settings.unitSystem': currentUnitSystem });
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'settingsChanged',
          settings: { unitSystem: currentUnitSystem }
        });
      }
    });

    if (currentTab === 'page') {
      loadPageLabs();
    }
    runSearch(searchInput.value.trim());
  });
});

highlightToggle.addEventListener('change', () => {
  const enabled = highlightToggle.checked;
  chrome.storage.local.set({ 'settings.autoHighlight': enabled });
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) {
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, { action: 'setHighlight', enabled });
  });
});

tooltipToggle.addEventListener('change', () => {
  const enabled = tooltipToggle.checked;
  chrome.storage.local.set({ 'settings.showTooltips': enabled });
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (!tabs[0]?.id) {
      return;
    }
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'settingsChanged',
      settings: { showTooltips: enabled }
    });
  });
});

openRefBtn.addEventListener('click', () => {
  const url = chrome.runtime.getURL('reference/reference.html');
  chrome.tabs.create({ url });
});

function getRanges(lab) {
  if (lab.ranges && typeof lab.ranges === 'object' && !Array.isArray(lab.ranges)) {
    return currentUnitSystem === 'si' && lab.ranges.si ? lab.ranges.si : lab.ranges.conventional;
  }
  return lab.ranges || [];
}

function buildLabCardHtml(lab) {
  const rangesHtml = getRanges(lab).map(range => {
    return `<div class="range-row"><span class="range-pop">${escHtml(range.population)}</span><span class="range-val">${formatRangeValue(range)}</span></div>`;
  }).join('');

  const notesHtml = lab.notes ? `<div class="card-notes">${escHtml(lab.notes)}</div>` : '';

  return `
    <div class="lab-card">
      <div class="card-header">
        <strong class="card-name">${escHtml(lab.name)}</strong>
        <span class="card-category">${escHtml(lab.category)}</span>
      </div>
      <div class="card-ranges">${rangesHtml}</div>
      ${notesHtml}
    </div>`;
}

function escHtml(value) {
  if (value == null) {
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

init().catch(err => console.warn('[LabValues Helper] Popup error:', err));
