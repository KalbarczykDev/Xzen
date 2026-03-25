# Xzen

> **Save your cortisol when scrolling Twitter/X.**

A Chrome extension that filters your X (Twitter) feed so you can scroll without the noise. When a post matches your active filters, it's replaced with a calming gradient placeholder. You can reveal any hidden post individually with one click.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-6366f1) ![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4)

---

## Features

- **Predefined filter categories** — toggle on/off with a single switch:
  - Politics & Identity (elections, parties, social policy, activism…)
  - Religion (faith, scripture, religious debate…)
  - Controversial (outrage, cancel culture, misinformation…)
  - Flag Emojis in Names — hides tweets from accounts that have a country flag emoji in their display name
- **Custom keywords** — add your own words; stored persistently via `chrome.storage.local`
- **Zen placeholder** — replaces filtered tweets with a soft gradient card and a "Reveal" button to restore the original on demand
- **Live updates** — settings apply instantly across all open X tabs without a page reload
- **Lightweight** — uses a single `MutationObserver` with `requestAnimationFrame` batching; no frameworks, no network requests

---

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the `Xzen` folder.
5. Navigate to [x.com](https://x.com) — the extension is active immediately.

---

## File Structure

```
Xzen/
├── manifest.json     # MV3 manifest — permissions, host rules, entry points
├── content.js        # MutationObserver engine: detection, replacement, placeholders
├── background.js     # Service worker: default settings, settings relay to open tabs
├── popup.html        # Popup UI
├── popup.css         # Popup styles
├── popup.js          # Popup logic — reads/writes chrome.storage, notifies tabs
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## How It Works

**Detection** — `content.js` attaches a `MutationObserver` to `document.body` watching for new `article[data-testid="tweet"]` nodes (X's stable tweet selector). Each new article is checked against:
- Active category keyword lists (tweet text + image `alt` attributes, case-insensitive)
- Custom keywords from storage
- Flag emoji regex on the author's display name (`[data-testid="User-Name"]`)

**Replacement** — Matched tweets are replaced with a `div.xzen-placeholder`. The original DOM node is held in memory on the placeholder element so the "Reveal" button can restore it without a network request.

**Settings sync** — The popup writes to `chrome.storage.local` and then sends a `SETTINGS_UPDATED` message directly to all open X tabs. `content.js` listens for this message and updates its state immediately; no reload required.

---

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Persist filter settings and custom keywords |
| `activeTab` | Send settings updates to the current tab |
| `host_permissions: x.com, twitter.com` | Inject the content script |
