/**
 * content.js — LabValues Helper content script
 * Scans page text for lab test names, highlights them, and shows
 * a tooltip with normal reference ranges on hover.
 */

'use strict';

let labData = [];
let masterRegex = null;
let aliasToLab = {};
let unitSystem = 'conventional';
let autoHighlight = true;
let showTooltips = true;
let detectedLabs = new Set();
let tooltip = null;
let observer = null;
let isProcessing = false;

const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT',
  'SELECT', 'BUTTON', 'HEAD', 'META', 'LINK', 'TITLE', 'CODE',
  'PRE', 'SVG', 'MATH'
]);

async function init() {
  try {
    const stored = await chrome.storage.local.get([
      'settings.unitSystem',
      'settings.autoHighlight',
      'settings.showTooltips',
      'highlightEnabled'
    ]);

    unitSystem = stored['settings.unitSystem'] || 'conventional';
    autoHighlight = stored['settings.autoHighlight'] !== undefined
      ? stored['settings.autoHighlight']
      : (stored.highlightEnabled !== undefined ? stored.highlightEnabled : true);
    showTooltips = stored['settings.showTooltips'] !== undefined ? stored['settings.showTooltips'] : true;

    const url = chrome.runtime.getURL('data/lab-values.json');
    const response = await fetch(url);
    labData = await response.json();

    buildRegex();
    ensureTooltip();
    scanDocument();
    startObserver();
  } catch (err) {
    console.warn('[LabValues Helper] Init error:', err);
  }
}

function buildRegex() {
  const terms = [];
  aliasToLab = {};

  labData.forEach(lab => {
    const names = [lab.name, ...(lab.aliases || [])];
    names.forEach(name => {
      const normalized = name.toLowerCase();
      aliasToLab[normalized] = lab;
      terms.push(name);
    });
  });

  terms.sort((a, b) => b.length - a.length);
  masterRegex = new RegExp(`\\b(${terms.map(escapeRegex).join('|')})\\b`, 'gi');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureTooltip() {
  if (tooltip) {
    return;
  }

  tooltip = document.createElement('div');
  tooltip.id = 'lvh-tooltip';
  tooltip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tooltip);
}

function getRanges(lab) {
  if (lab.ranges && typeof lab.ranges === 'object' && !Array.isArray(lab.ranges)) {
    return unitSystem === 'si' && lab.ranges.si ? lab.ranges.si : lab.ranges.conventional;
  }
  return lab.ranges || [];
}

function showTooltip(lab, anchorRect) {
  if (!showTooltips) {
    return;
  }

  ensureTooltip();

  const rangesHtml = getRanges(lab).map(range => {
    return `
      <div class="lvh-range-row">
        <span class="lvh-range-population">${escapeHtml(range.population)}</span>
        <span class="lvh-range-value">${formatRangeValue(range)}</span>
      </div>`;
  }).join('');

  const notesHtml = lab.notes ? `<div class="lvh-notes">${escapeHtml(lab.notes)}</div>` : '';

  tooltip.innerHTML = `
    <div class="lvh-tooltip-header">
      <p class="lvh-tooltip-name">${escapeHtml(lab.name)}</p>
      <p class="lvh-tooltip-category">${escapeHtml(lab.category)}</p>
    </div>
    <div class="lvh-tooltip-body">
      ${rangesHtml}
      ${notesHtml}
    </div>`;

  tooltip.style.display = 'block';
  tooltip.style.opacity = '0';

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const tooltipWidth = tooltip.offsetWidth;
  const tooltipHeight = tooltip.offsetHeight;

  let top = anchorRect.bottom + 8;
  let left = anchorRect.left;

  if (top + tooltipHeight > viewportHeight - 8) {
    top = anchorRect.top - tooltipHeight - 8;
  }
  if (left + tooltipWidth > viewportWidth - 8) {
    left = viewportWidth - tooltipWidth - 8;
  }
  if (left < 8) {
    left = 8;
  }
  if (top < 8) {
    top = 8;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add('lvh-visible');
}

function hideTooltip() {
  if (!tooltip) {
    return;
  }
  tooltip.classList.remove('lvh-visible');
}

function escapeHtml(value) {
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
  const unit = escapeHtml(range.unit);
  if (range.low === null || range.low === undefined) {
    return range.high !== null && range.high !== undefined ? `&lt; ${escapeHtml(range.high)} ${unit}` : 'Negative';
  }
  if (range.high === null || range.high === undefined) {
    return `&ge; ${escapeHtml(range.low)} ${unit}`;
  }
  return `${escapeHtml(range.low)}–${escapeHtml(range.high)} ${unit}`;
}

function scanDocument() {
  if (!masterRegex || !document.body) {
    return;
  }
  detectedLabs.clear();
  scanNode(document.body);
}

function scanNode(root) {
  if (!root || !masterRegex) {
    return;
  }

  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root);
    return;
  }

  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) {
    return;
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) {
          return NodeFilter.FILTER_REJECT;
        }
        if (SKIP_TAGS.has(parent.tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.isContentEditable) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parent.closest('.lvh-highlight') || parent.closest('#lvh-tooltip')) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  textNodes.forEach(processTextNode);
}

function processTextNode(textNode) {
  const text = textNode.nodeValue;
  if (!text) {
    return;
  }

  masterRegex.lastIndex = 0;
  if (!masterRegex.test(text)) {
    return;
  }

  masterRegex.lastIndex = 0;

  if (!autoHighlight) {
    trackMatches(text);
    return;
  }

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = masterRegex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;

    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    const lab = aliasToLab[matchedText.toLowerCase()];
    if (!lab) {
      fragment.appendChild(document.createTextNode(matchedText));
      lastIndex = start + matchedText.length;
      continue;
    }

    detectedLabs.add(lab.id);

    const span = document.createElement('span');
    span.className = 'lvh-highlight';
    span.dataset.labId = lab.id;
    span.textContent = matchedText;
    span.title = showTooltips ? `${lab.name} — hover for reference range` : lab.name;
    span.addEventListener('mouseenter', () => {
      if (!showTooltips) {
        return;
      }
      showTooltip(lab, span.getBoundingClientRect());
    });
    span.addEventListener('mouseleave', hideTooltip);
    fragment.appendChild(span);

    lastIndex = start + matchedText.length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  if (fragment.childNodes.length > 1 || (fragment.firstChild && fragment.firstChild.nodeType !== Node.TEXT_NODE)) {
    if (!textNode.parentNode) return;
    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

function trackMatches(text) {
  masterRegex.lastIndex = 0;
  let match;
  while ((match = masterRegex.exec(text)) !== null) {
    const lab = aliasToLab[match[0].toLowerCase()];
    if (lab) {
      detectedLabs.add(lab.id);
    }
  }
}

function clearHighlights() {
  document.querySelectorAll('.lvh-highlight').forEach(element => {
    element.replaceWith(document.createTextNode(element.textContent));
  });
  document.body.normalize();
  hideTooltip();
}

function startObserver() {
  if (observer) {
    observer.disconnect();
  }

  let debounceTimer = null;

  observer = new MutationObserver(mutations => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isProcessing) {
        return;
      }

      isProcessing = true;
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node === tooltip) {
            return;
          }
          scanNode(node);
        });
      });
      isProcessing = false;
    }, 250);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function applySettings(settings = {}) {
  const prevHighlight = autoHighlight;

  if (settings.unitSystem) {
    unitSystem = settings.unitSystem;
    hideTooltip();
  }
  if (typeof settings.showTooltips === 'boolean') {
    showTooltips = settings.showTooltips;
    if (!showTooltips) {
      hideTooltip();
    }
  }
  if (typeof settings.autoHighlight === 'boolean') {
    autoHighlight = settings.autoHighlight;
  }

  if (typeof settings.autoHighlight === 'boolean' && prevHighlight !== autoHighlight) {
    clearHighlights();
    if (autoHighlight) {
      scanDocument();
    }
  }
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') {
    return;
  }

  const next = {};
  if ('settings.unitSystem' in changes) {
    next.unitSystem = changes['settings.unitSystem'].newValue;
  }
  if ('settings.autoHighlight' in changes) {
    next.autoHighlight = changes['settings.autoHighlight'].newValue;
  } else if ('highlightEnabled' in changes) {
    next.autoHighlight = changes.highlightEnabled.newValue;
  }
  if ('settings.showTooltips' in changes) {
    next.showTooltips = changes['settings.showTooltips'].newValue;
  }

  if (Object.keys(next).length > 0) {
    applySettings(next);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDetectedLabs') {
    sendResponse({ labs: labData.filter(lab => detectedLabs.has(lab.id)) });
    return true;
  }

  if (message.action === 'setHighlight') {
    applySettings({ autoHighlight: !!message.enabled });
    sendResponse({ ok: true });
    return true;
  }

  if (message.action === 'settingsChanged') {
    applySettings(message.settings || {});
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

init();
