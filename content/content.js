/**
 * content.js — LabValues Helper content script
 * Scans page text for lab test names, highlights them, and shows
 * a tooltip with normal reference ranges on hover.
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
let labData = [];           // Loaded from data/lab-values.json
let masterRegex = null;     // Combined regex for all lab names + aliases
let aliasToLab = {};        // Maps lowercase alias → lab entry
let highlightEnabled = true;
let detectedLabs = new Set(); // Lab IDs found on page
let tooltip = null;
let observer = null;
let isProcessing = false;

// ── Tags to skip when scanning ─────────────────────────────────────────────
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'TEXTAREA', 'INPUT',
  'SELECT', 'BUTTON', 'HEAD', 'META', 'LINK', 'TITLE', 'CODE',
  'PRE', 'SVG', 'MATH'
]);

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  try {
    // Load persisted highlight toggle
    const stored = await chrome.storage.local.get(['highlightEnabled']);
    if (stored.highlightEnabled !== undefined) {
      highlightEnabled = stored.highlightEnabled;
    }

    if (!highlightEnabled) return;

    // Fetch lab data
    const url = chrome.runtime.getURL('data/lab-values.json');
    const response = await fetch(url);
    labData = await response.json();

    buildRegex();
    createTooltip();
    scanDocument();
    startObserver();
  } catch (err) {
    console.warn('[LabValues Helper] Init error:', err);
  }
}

// ── Build master regex + alias map ─────────────────────────────────────────
function buildRegex() {
  const terms = [];

  labData.forEach(lab => {
    const allNames = [lab.name, ...lab.aliases];
    allNames.forEach(alias => {
      const lower = alias.toLowerCase();
      // Map alias → lab entry (keep longest alias for a given lab)
      aliasToLab[lower] = lab;
      terms.push(alias);
    });
  });

  // Sort longest-first to avoid partial-match issues (e.g. "HbA1c" before "Hb")
  terms.sort((a, b) => b.length - a.length);

  // Build regex: case-insensitive, word-boundary delimited
  const escaped = terms.map(t => escapeRegex(t));
  masterRegex = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function escapeRegex(str) {
  // Escape regex special characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Tooltip creation ───────────────────────────────────────────────────────
function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.id = 'lvh-tooltip';
  tooltip.setAttribute('aria-live', 'polite');
  document.body.appendChild(tooltip);
}

function showTooltip(lab, anchorRect) {
  if (!tooltip) return;

  // Build range rows HTML
  const rangesHtml = lab.ranges.map(r => {
    let valueStr;
    if (r.low === null || r.low === 0 && r.high === 0) {
      valueStr = r.high !== null ? `< ${r.high} ${r.unit}` : 'Negative';
    } else if (r.high === null) {
      valueStr = `≥ ${r.low} ${r.unit}`;
    } else {
      valueStr = `${r.low}–${r.high} ${r.unit}`;
    }
    return `
      <div class="lvh-range-row">
        <span class="lvh-range-population">${escapeHtml(r.population)}</span>
        <span class="lvh-range-value">${escapeHtml(valueStr)}</span>
      </div>`;
  }).join('');

  const siHtml = lab.siRange
    ? `<div class="lvh-si-row"><span class="lvh-si-label">SI:</span>${escapeHtml(lab.siRange)}</div>`
    : '';

  const notesHtml = lab.notes
    ? `<div class="lvh-notes">${escapeHtml(lab.notes)}</div>`
    : '';

  tooltip.innerHTML = `
    <div class="lvh-tooltip-header">
      <p class="lvh-tooltip-name">${escapeHtml(lab.name)}</p>
      <p class="lvh-tooltip-category">${escapeHtml(lab.category)}</p>
    </div>
    <div class="lvh-tooltip-body">
      ${rangesHtml}
      ${siHtml}
      ${notesHtml}
    </div>`;

  // Position tooltip (flip if near viewport edge)
  tooltip.style.opacity = '0';
  tooltip.style.display = 'block';

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;

  let top = anchorRect.bottom + 8;
  let left = anchorRect.left;

  // Flip above if not enough room below
  if (top + th > vh - 8) {
    top = anchorRect.top - th - 8;
  }
  // Keep within viewport horizontally
  if (left + tw > vw - 8) {
    left = vw - tw - 8;
  }
  if (left < 8) left = 8;
  if (top < 8) top = 8;

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  tooltip.classList.add('lvh-visible');
}

function hideTooltip() {
  if (!tooltip) return;
  tooltip.classList.remove('lvh-visible');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── DOM scanning ───────────────────────────────────────────────────────────
function scanDocument() {
  if (!masterRegex || !highlightEnabled) return;
  scanNode(document.body);
}

function scanNode(root) {
  if (!root) return;
  // Walk text nodes
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        // Skip unwanted tags
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        // Skip contenteditable
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        // Skip already-highlighted spans (prevent double-highlight)
        if (parent.classList.contains('lvh-highlight')) return NodeFilter.FILTER_REJECT;
        // Skip empty/whitespace-only nodes
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  // Process collected text nodes
  textNodes.forEach(processTextNode);
}

function processTextNode(textNode) {
  const text = textNode.nodeValue;
  masterRegex.lastIndex = 0;

  if (!masterRegex.test(text)) return; // Fast path: no match

  masterRegex.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match;

  while ((match = masterRegex.exec(text)) !== null) {
    const matchedText = match[0];
    const start = match.index;

    // Append text before match
    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    // Look up lab data
    const lab = aliasToLab[matchedText.toLowerCase()];
    if (lab) {
      detectedLabs.add(lab.id);

      const span = document.createElement('span');
      span.className = 'lvh-highlight';
      span.textContent = matchedText;
      span.dataset.labId = lab.id;
      span.title = `${lab.name} — hover for reference range`;

      // Tooltip events
      span.addEventListener('mouseenter', (e) => {
        showTooltip(lab, span.getBoundingClientRect());
      });
      span.addEventListener('mouseleave', hideTooltip);

      fragment.appendChild(span);
    } else {
      fragment.appendChild(document.createTextNode(matchedText));
    }

    lastIndex = start + matchedText.length;
  }

  // Append remaining text
  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  // Replace original text node with fragment
  if (fragment.childNodes.length > 1 || (fragment.firstChild && fragment.firstChild.nodeType !== Node.TEXT_NODE)) {
    textNode.parentNode.replaceChild(fragment, textNode);
  }
}

// ── MutationObserver for SPAs ──────────────────────────────────────────────
function startObserver() {
  if (observer) observer.disconnect();

  let debounceTimer = null;

  observer = new MutationObserver((mutations) => {
    if (!highlightEnabled) return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (isProcessing) return;
      isProcessing = true;

      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            scanNode(node);
          }
        });
      });

      isProcessing = false;
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// ── Message handling (from popup) ─────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDetectedLabs') {
    const labs = labData.filter(lab => detectedLabs.has(lab.id));
    sendResponse({ labs });
    return true;
  }

  if (message.action === 'setHighlight') {
    highlightEnabled = message.enabled;
    if (!highlightEnabled) {
      // Remove all highlights
      document.querySelectorAll('.lvh-highlight').forEach(el => {
        el.replaceWith(document.createTextNode(el.textContent));
      });
      if (observer) observer.disconnect();
      hideTooltip();
    } else {
      // Re-scan page
      buildRegex();
      if (!tooltip) createTooltip();
      scanDocument();
      startObserver();
    }
    sendResponse({ ok: true });
    return true;
  }
});

// ── Start ──────────────────────────────────────────────────────────────────
init();
