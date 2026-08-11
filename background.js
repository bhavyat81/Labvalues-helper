// background.js — LabValues Helper service worker
// Handles cross-tab messaging and extension lifecycle events.

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings on install
  chrome.storage.local.get(['highlightEnabled'], (result) => {
    if (result.highlightEnabled === undefined) {
      chrome.storage.local.set({ highlightEnabled: true });
    }
  });
});

// Relay messages between popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDetectedLabs') {
    // Forward request to active tab's content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getDetectedLabs' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ labs: [] });
          } else {
            sendResponse(response);
          }
        });
      } else {
        sendResponse({ labs: [] });
      }
    });
    return true; // async response
  }
});
