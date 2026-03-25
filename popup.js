// popup.js — Xzen Popup Controller

'use strict';

// ─── DOM References ───────────────────────────────────────────────────────────

const masterToggle  = document.getElementById('masterToggle');
const statusBanner  = document.getElementById('statusBanner');
const statusText    = document.getElementById('statusText');
const mainContent   = document.getElementById('mainContent');
const keywordInput  = document.getElementById('keywordInput');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const keywordList   = document.getElementById('keywordList');
const keywordEmpty  = document.getElementById('keywordEmpty');
const categoryToggles = document.querySelectorAll('.category-toggle');

// ─── State ────────────────────────────────────────────────────────────────────

let settings = {
  enabled: true,
  categories: { politics: true, religion: false, controversial: false, flagEmojis: false },
  customKeywords: []
};

// ─── Storage Helpers ──────────────────────────────────────────────────────────

function saveSettings() {
  chrome.storage.local.set({ xzenSettings: settings }, () => {
    notifyContentScripts();
  });
}

function notifyContentScripts() {
  // Send updated settings to all active X.com tabs directly
  chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings })
        .catch(() => {}); // Tab may not have content script loaded
    });
  });
}

// ─── UI Rendering ─────────────────────────────────────────────────────────────

function renderUI() {
  // Master toggle
  masterToggle.checked = settings.enabled;

  // Status banner
  if (settings.enabled) {
    statusBanner.className = 'status-banner active';
    statusText.textContent = 'Zen mode active — filtering your feed.';
    mainContent.classList.remove('dimmed');
  } else {
    statusBanner.className = 'status-banner inactive';
    statusText.textContent = 'Zen mode paused — all content visible.';
    mainContent.classList.add('dimmed');
  }

  // Category toggles
  categoryToggles.forEach((toggle) => {
    const cat = toggle.dataset.category;
    toggle.checked = !!settings.categories[cat];
  });

  // Custom keywords
  renderKeywordList();
}

function renderKeywordList() {
  const keywords = settings.customKeywords || [];

  if (keywords.length === 0) {
    keywordList.innerHTML = '';
    keywordEmpty.style.display = 'block';
    return;
  }

  keywordEmpty.style.display = 'none';

  keywordList.innerHTML = keywords
    .map(
      (kw, index) => `
        <li class="keyword-tag" data-index="${index}">
          <span class="keyword-tag-text" title="${escapeHtml(kw)}">${escapeHtml(kw)}</span>
          <button class="btn-delete" data-index="${index}" aria-label="Remove keyword: ${escapeHtml(kw)}">
            <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </li>
      `
    )
    .join('');
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

// Master toggle
masterToggle.addEventListener('change', () => {
  settings.enabled = masterToggle.checked;
  saveSettings();
  renderUI();
});

// Category toggles
categoryToggles.forEach((toggle) => {
  toggle.addEventListener('change', () => {
    const cat = toggle.dataset.category;
    settings.categories[cat] = toggle.checked;
    saveSettings();
  });
});

// Add keyword — button click
addKeywordBtn.addEventListener('click', addKeyword);

// Add keyword — Enter key
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addKeyword();
});

function addKeyword() {
  const raw = keywordInput.value.trim().toLowerCase();
  if (!raw) return;

  // Prevent duplicates
  if (settings.customKeywords.includes(raw)) {
    keywordInput.select();
    return;
  }

  settings.customKeywords.push(raw);
  keywordInput.value = '';
  saveSettings();
  renderKeywordList();
}

// Delete keyword — event delegation on the list
keywordList.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn-delete');
  if (!btn) return;
  const index = parseInt(btn.dataset.index, 10);
  if (isNaN(index)) return;

  settings.customKeywords.splice(index, 1);
  saveSettings();
  renderKeywordList();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

chrome.storage.local.get('xzenSettings', (result) => {
  if (result.xzenSettings) {
    settings = result.xzenSettings;
    // Ensure all expected keys exist (forward-compat for older stored settings)
    settings.categories = Object.assign(
      { politics: true, religion: false, controversial: false, flagEmojis: false },
      settings.categories
    );
    settings.customKeywords = settings.customKeywords || [];
  }
  renderUI();
});
