// background.js — Service Worker
// Listens for messages from content scripts and manages cross-tab state.

chrome.runtime.onInstalled.addListener(() => {
  // Set default settings on first install
  chrome.storage.local.get('xzenSettings', (result) => {
    if (!result.xzenSettings) {
      chrome.storage.local.set({
        xzenSettings: {
          enabled: true,
          categories: {
            politics: true,
            religion: false,
            controversial: false,
            flagEmojis: false
          },
          customKeywords: []
        }
      });
    }
  });
});

// Relay settings-changed messages to all X.com tabs so content scripts update immediately
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SETTINGS_UPDATED') {
    chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
      tabs.forEach((tab) => {
        // Don't re-send to the tab that triggered the change (popup does it directly)
        chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings: message.settings })
          .catch(() => {}); // Tab may not have content script yet
      });
    });
    sendResponse({ ok: true });
  }
  return false;
});
