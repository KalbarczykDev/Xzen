// content.js — Xzen Content Script
// Watches the X.com feed via MutationObserver and mutates flagged tweets
// in-place: replaces the text and swaps images for the cortisol meme.

(() => {
  'use strict';

  const MEME_URL = chrome.runtime.getURL('meme.jpg');

  // ─── Keyword Definitions ────────────────────────────────────────────────────

  const CATEGORY_KEYWORDS = {
    politics: [
      'election', 'trump', 'biden', 'democrat', 'republican', 'gop', 'maga',
      'liberal', 'conservative', 'lgbt', 'lgbtq', 'pride', 'woke', 'policy',
      'congress', 'senate', 'legislation', 'politician', 'vote', 'ballot',
      'immigration', 'border', 'abortion', 'gun control', 'second amendment',
      'socialist', 'fascist', 'antifa', 'blm', 'protest', 'riot', 'activist',
      'gender', 'transgender', 'nonbinary', 'pronouns'
    ],
    religion: [
      'christian', 'christianity', 'jesus', 'christ', 'god', 'bible',
      'allah', 'islam', 'islamic', 'muslim', 'quran', 'muhammad', 'prophet',
      'jewish', 'jew', 'judaism', 'torah', 'synagogue', 'hindu', 'hinduism',
      'buddhist', 'buddhism', 'atheist', 'atheism', 'religion', 'religious',
      'church', 'mosque', 'temple', 'prayer', 'faith', 'salvation', 'hell',
      'heaven', 'sin', 'blasphemy', 'crusade', 'jihad'
    ],
    controversial: [
      'outrage', 'cancel culture', 'cancelled', 'problematic', 'toxic',
      'vaccine', 'anti-vax', 'antivaxx', 'covid', 'pandemic', 'conspiracy',
      'fake news', 'misinformation', 'propaganda', 'brainwashed', 'sheep',
      'mainstream media', 'deep state', 'globalist', 'nwo', 'flat earth',
      'climate change', 'global warming', 'crisis', 'recession', 'inflation',
      'censorship', 'free speech', 'shadow ban', 'deplatform'
    ]
  };

  const CATEGORY_LABELS = {
    politics: 'politics',
    religion: 'religion',
    controversial: 'controversial content'
  };

  // ─── Flag Emoji Detection ────────────────────────────────────────────────────

  const FLAG_EMOJI_RE = /\p{RI}\p{RI}|\uD83C\uDFF4[\uDB40\uDC67\uDB40\uDC62][\s\S]*?\uDB40\uDC7F/u;

  function authorHasFlagEmoji(article) {
    const nameEl = article.querySelector('[data-testid="User-Name"]');
    if (!nameEl) return false;
    return FLAG_EMOJI_RE.test(nameEl.textContent);
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  let settings = {
    enabled: true,
    categories: { politics: true, religion: false, controversial: false, flagEmojis: false },
    customKeywords: []
  };

  // Tracks articles already processed (mutated or checked and passed)
  const processed = new WeakSet();

  // ─── Settings Loading ────────────────────────────────────────────────────────

  function loadSettings(callback) {
    chrome.storage.local.get('xzenSettings', (result) => {
      if (result.xzenSettings) settings = result.xzenSettings;
      if (callback) callback();
    });
  }

  // ─── Match Reason Detection ───────────────────────────────────────────────────
  // Returns an array of human-readable reasons the tweet was flagged,
  // or an empty array if it doesn't match.

  function getMatchReasons(article) {
    const reasons = [];

    if (settings.categories.flagEmojis && authorHasFlagEmoji(article)) {
      reasons.push('flag emoji in name');
    }

    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextEl ? tweetTextEl.innerText : '';
    const altTexts = [...article.querySelectorAll('img[alt]')]
      .map((img) => img.getAttribute('alt'))
      .join(' ');
    const combinedText = `${tweetText} ${altTexts}`.toLowerCase();

    // Category keyword matches
    for (const [cat, label] of Object.entries(CATEGORY_LABELS)) {
      if (settings.categories[cat] && CATEGORY_KEYWORDS[cat]) {
        if (CATEGORY_KEYWORDS[cat].some((kw) => combinedText.includes(kw))) {
          reasons.push(label);
        }
      }
    }

    // Custom keyword matches
    const matchedCustom = (settings.customKeywords || [])
      .filter((kw) => combinedText.includes(kw.toLowerCase()));
    matchedCustom.forEach((kw) => reasons.push(`"${kw}"`));

    return reasons;
  }

  // ─── In-place Tweet Mutation ─────────────────────────────────────────────────

  function mutateTweet(article, reasons) {
    const reasonText = reasons.join(', ');

    // 1. Replace tweet text
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl) {
      tweetTextEl._xzenOriginalHTML = tweetTextEl.innerHTML;
      tweetTextEl.innerHTML =
        `<span class="xzen-msg">I wanted to spike your cortisol with: <strong>${reasonText}</strong></span>`;
    }

    // 2. Replace images with the meme
    // X wraps tweet photos in [data-testid="tweetPhoto"]; cards use similar containers
    const imgContainers = article.querySelectorAll(
      '[data-testid="tweetPhoto"], [data-testid^="card"] img, [data-testid="tweet-image-container"]'
    );

    imgContainers.forEach((el) => {
      const img = el.tagName === 'IMG' ? el : el.querySelector('img');
      if (!img || img._xzenDone) return;
      img._xzenDone = true;
      img._xzenOriginalSrc    = img.src;
      img._xzenOriginalSrcset = img.srcset;
      img.src    = MEME_URL;
      img.srcset = '';
      img.style.objectFit = 'contain';
    });

    article.setAttribute('data-xzen', 'modified');
  }

  function restoreTweet(article) {
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    if (tweetTextEl && tweetTextEl._xzenOriginalHTML !== undefined) {
      tweetTextEl.innerHTML = tweetTextEl._xzenOriginalHTML;
      delete tweetTextEl._xzenOriginalHTML;
    }

    article.querySelectorAll('img').forEach((img) => {
      if (!img._xzenDone) return;
      img.src    = img._xzenOriginalSrc;
      img.srcset = img._xzenOriginalSrcset;
      img.style.objectFit = '';
      delete img._xzenDone;
      delete img._xzenOriginalSrc;
      delete img._xzenOriginalSrcset;
    });

    article.removeAttribute('data-xzen');
    processed.delete(article);
  }

  // ─── Inline Styles ───────────────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('xzen-styles')) return;
    const style = document.createElement('style');
    style.id = 'xzen-styles';
    style.textContent = `
      .xzen-msg {
        font-style: italic;
        color: #64748b;
        font-size: 15px;
        line-height: 1.5;
      }
      .xzen-msg strong {
        color: #475569;
        font-style: normal;
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Tweet Processing ────────────────────────────────────────────────────────

  function processTweet(article) {
    if (processed.has(article)) return;
    processed.add(article);

    if (!settings.enabled) return;

    const reasons = getMatchReasons(article);
    if (reasons.length === 0) return;

    mutateTweet(article, reasons);
  }

  // ─── Scan Existing Tweets ────────────────────────────────────────────────────

  function scanAll() {
    document.querySelectorAll('article[data-testid="tweet"]').forEach(processTweet);
  }

  function restoreAll() {
    document.querySelectorAll('article[data-testid="tweet"][data-xzen]').forEach(restoreTweet);
  }

  // ─── MutationObserver ────────────────────────────────────────────────────────

  let observer = null;

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const newArticles = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          if (node.matches('article[data-testid="tweet"]')) {
            newArticles.push(node);
          } else {
            node.querySelectorAll('article[data-testid="tweet"]').forEach((a) => newArticles.push(a));
          }
        }
      }
      if (newArticles.length > 0) {
        requestAnimationFrame(() => newArticles.forEach(processTweet));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  // ─── Settings Change Listener ─────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SETTINGS_UPDATED') {
      settings = message.settings;
      if (settings.enabled) {
        injectStyles();
        startObserver();
        scanAll();
      } else {
        stopObserver();
        restoreAll();
      }
    }
  });

  // ─── Boot ────────────────────────────────────────────────────────────────────

  loadSettings(() => {
    if (settings.enabled) {
      injectStyles();
      startObserver();
      setTimeout(scanAll, 800);
    }
  });
})();
