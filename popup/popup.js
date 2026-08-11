/**
 * popup.js — LabValues Helper popup script
 * Handles search, page-detected labs list, and highlight toggle.
 */

'use strict';

let labData = [];

// ── DOM refs ───────────────────────────────────────────────────────────────
const searchInput = document.getElementById('search-input');
const clearBtn    = document.getElementById('clear-search');
const searchResults = document.getElementById('search-results');
const pageLabsList  = document.getElementById('page-labs-list');
const highlightToggle = document.getElementById('highlight-toggle');
const openRefBtn    = document.getElementById('open-reference');

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  // Load lab data
  const url = chrome.runtime.getURL('data/lab-values.json');
  const res = await fetch(url);
  labData = await res.json();

  // Restore highlight toggle state
  const stored = await chrome.storage.local.get(['highlightEnabled']);
  const enabled = stored.highlightEnabled !== undefined ? stored.highlightEnabled : true;
  highlightToggle.checked = enabled;

  // Load page-detected labs
  loadPageLabs();
}

// ── Search ─────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  clearBtn.style.display = query ? 'block' : 'none';

  if (!query) {
    searchResults.style.display = 'none';
    document.getElementById('page-labs-section').style.display = 'flex';
    return;
  }

  const matches = labData.filter(lab => {
    if (lab.name.toLowerCase().includes(query)) return true;
    if (lab.id.toLowerCase().includes(query)) return true;
    return lab.aliases.some(a => a.toLowerCase().includes(query));
  });

  renderSearchResults(matches, query);
  searchResults.style.display = 'block';
  document.getElementById('page-labs-section').style.display = 'none';
});

clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearBtn.style.display = 'none';
  searchResults.style.display = 'none';
  document.getElementById('page-labs-section').style.display = 'flex';
  searchInput.focus();
});

function renderSearchResults(labs, query) {
  if (labs.length === 0) {
    searchResults.innerHTML = '<p class="empty-state">No matching lab values found.</p>';
    return;
  }
  searchResults.innerHTML = labs.map(lab => buildLabCardHtml(lab)).join('');
}

// ── Page-detected labs ─────────────────────────────────────────────────────
function loadPageLabs() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) {
      pageLabsList.innerHTML = '<p class="empty-state">No active tab found.</p>';
      return;
    }

    chrome.tabs.sendMessage(tabs[0].id, { action: 'getDetectedLabs' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        pageLabsList.innerHTML = '<p class="empty-state">Could not read page content. Try refreshing.</p>';
        return;
      }

      const labs = response.labs || [];
      if (labs.length === 0) {
        pageLabsList.innerHTML = '<p class="empty-state">No lab values detected on this page.</p>';
      } else {
        pageLabsList.innerHTML = labs.map(lab => buildLabCardHtml(lab)).join('');
      }
    });
  });
}

// ── Highlight toggle ───────────────────────────────────────────────────────
highlightToggle.addEventListener('change', () => {
  const enabled = highlightToggle.checked;
  chrome.storage.local.set({ highlightEnabled: enabled });

  // Notify content script on current tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'setHighlight',
      enabled
    });
  });
});

// ── Open full reference page ───────────────────────────────────────────────
openRefBtn.addEventListener('click', () => {
  const url = chrome.runtime.getURL('reference/reference.html');
  chrome.tabs.create({ url });
});

// ── Lab card HTML builder ──────────────────────────────────────────────────
function buildLabCardHtml(lab) {
  const rangesHtml = lab.ranges.map(r => {
    let valueStr;
    if (r.low === null || (r.low === 0 && r.high === 0)) {
      valueStr = r.high !== null ? `&lt; ${r.high} ${escHtml(r.unit)}` : 'Negative';
    } else if (r.high === null) {
      valueStr = `&ge; ${r.low} ${escHtml(r.unit)}`;
    } else {
      valueStr = `${r.low}–${r.high} ${escHtml(r.unit)}`;
    }
    return `
      <div class="range-row">
        <span class="range-population">${escHtml(r.population)}</span>
        <span class="range-value">${valueStr}</span>
      </div>`;
  }).join('');

  const siHtml = lab.siRange
    ? `<div class="lab-card-si"><strong>SI:</strong> ${escHtml(lab.siRange)}</div>`
    : '';

  const notesHtml = lab.notes
    ? `<div class="lab-card-notes">${escHtml(lab.notes)}</div>`
    : '';

  return `
    <div class="lab-card">
      <div class="lab-card-header">
        <span class="lab-card-name">${escHtml(lab.name)}</span>
        <span class="lab-card-category">${escHtml(lab.category)}</span>
      </div>
      <div class="lab-card-ranges">${rangesHtml}</div>
      ${siHtml}
      ${notesHtml}
    </div>`;
}

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Start ──────────────────────────────────────────────────────────────────
init().catch(err => console.warn('[LabValues Helper] Popup error:', err));
