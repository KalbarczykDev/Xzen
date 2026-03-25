// content.js — Xzen Content Script
// Watches the X.com feed via MutationObserver and replaces flagged tweets
// with a calming Zen placeholder.

(() => {
  'use strict';

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

  // ─── Flag Emoji Detection ────────────────────────────────────────────────────

  // Matches any pair of Regional Indicator Symbols (U+1F1E6–U+1F1FF) = a country flag emoji.
  // Also matches the England/Scotland/Wales subdivision flags (black flag + tag sequence).
  const FLAG_EMOJI_RE = /\p{RI}\p{RI}|\uD83C\uDFF4[\uDB40\uDC67\uDB40\uDC62][\s\S]*?\uDB40\uDC7F/u;

  function authorHasFlagEmoji(article) {
    // X renders the display name in [data-testid="User-Name"] > span elements
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

  // WeakSet to track already-processed tweet articles (avoids reprocessing)
  const processed = new WeakSet();

  // ─── Settings Loading ────────────────────────────────────────────────────────

  function loadSettings(callback) {
    chrome.storage.local.get('xzenSettings', (result) => {
      if (result.xzenSettings) {
        settings = result.xzenSettings;
      }
      if (callback) callback();
    });
  }

  // ─── Keyword Matching ────────────────────────────────────────────────────────

  function buildActiveKeywords() {
    const keywords = [];
    for (const [category, active] of Object.entries(settings.categories)) {
      if (active && CATEGORY_KEYWORDS[category]) {
        keywords.push(...CATEGORY_KEYWORDS[category]);
      }
    }
    keywords.push(...(settings.customKeywords || []));
    // Deduplicate and lowercase
    return [...new Set(keywords.map((k) => k.toLowerCase()))];
  }

  function tweetMatchesFilters(article, activeKeywords) {
    // Flag emoji check (runs first — cheapest selector hit)
    if (settings.categories.flagEmojis && authorHasFlagEmoji(article)) return true;

    if (activeKeywords.length === 0) return false;

    // Gather all text: tweet body + image alt texts
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    const tweetText = tweetTextEl ? tweetTextEl.innerText : '';

    const altTexts = [...article.querySelectorAll('img[alt]')]
      .map((img) => img.getAttribute('alt'))
      .join(' ');

    const combinedText = `${tweetText} ${altTexts}`.toLowerCase();

    return activeKeywords.some((kw) => combinedText.includes(kw));
  }

  // ─── Placeholder Creation ────────────────────────────────────────────────────

  function createPlaceholder(hadImage) {
    const placeholder = document.createElement('div');
    placeholder.className = 'xzen-placeholder';
    placeholder.setAttribute('role', 'status');
    placeholder.setAttribute('aria-label', 'Content hidden by Xzen');

    placeholder.innerHTML = `
      <div class="xzen-inner">
        <div class="xzen-icon">${hadImage ? peaceIconSVG() : zenIconSVG()}</div>
        <p class="xzen-message">Content hidden to maintain your Zen.</p>
        <button class="xzen-reveal" aria-label="Reveal hidden content">Reveal</button>
      </div>
    `;

    // Reveal button — swap placeholder back with original content
    placeholder.querySelector('.xzen-reveal').addEventListener('click', (e) => {
      e.stopPropagation();
      const original = placeholder._xzenOriginal;
      if (original) {
        placeholder.replaceWith(original);
      }
    });

    return placeholder;
  }

  function peaceIconSVG() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="32" cy="32" r="26"/>
        <line x1="32" y1="6" x2="32" y2="58"/>
        <line x1="32" y1="32" x2="12" y2="50"/>
        <line x1="32" y1="32" x2="52" y2="50"/>
      </svg>
    `;
  }

  function zenIconSVG() {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 40 Q32 20 48 40"/>
        <circle cx="32" cy="20" r="5"/>
        <line x1="32" y1="44" x2="32" y2="56"/>
        <line x1="22" y1="54" x2="42" y2="54"/>
      </svg>
    `;
  }

  // ─── Inline Styles (injected once) ──────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('xzen-styles')) return;
    const style = document.createElement('style');
    style.id = 'xzen-styles';
    style.textContent = `
      .xzen-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
        margin: 0;
        padding: 0;
        border-radius: 16px;
        background: linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #fdf4ff 100%);
        border: 1px solid rgba(148, 163, 184, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        width: 100%;
        box-sizing: border-box;
        transition: opacity 0.3s ease;
      }

      .xzen-inner {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px 24px;
        text-align: center;
      }

      .xzen-icon {
        width: 42px;
        height: 42px;
        color: #64748b;
        opacity: 0.7;
      }

      .xzen-icon svg {
        width: 100%;
        height: 100%;
      }

      .xzen-message {
        margin: 0;
        font-size: 14px;
        color: #64748b;
        font-weight: 400;
        letter-spacing: 0.01em;
      }

      .xzen-reveal {
        background: none;
        border: 1px solid rgba(100, 116, 139, 0.4);
        color: #64748b;
        font-size: 12px;
        padding: 4px 14px;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
        letter-spacing: 0.02em;
      }

      .xzen-reveal:hover {
        background: rgba(100, 116, 139, 0.1);
        border-color: rgba(100, 116, 139, 0.6);
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Tweet Processing ────────────────────────────────────────────────────────

  /**
   * Attempt to find the outermost tweet container for clean replacement.
   * X renders tweets inside <article> elements, wrapped in a <div> cell.
   */
  function getTweetContainer(article) {
    // Walk up to find the list-item cell div that wraps the article
    let el = article.parentElement;
    for (let i = 0; i < 4; i++) {
      if (!el) break;
      const role = el.getAttribute('role');
      if (role === 'listitem' || role === 'article') return el;
      el = el.parentElement;
    }
    return article; // Fallback: replace the article itself
  }

  function processTweet(article) {
    if (processed.has(article)) return;
    processed.add(article);

    if (!settings.enabled) return;

    const activeKeywords = buildActiveKeywords();
    if (!tweetMatchesFilters(article, activeKeywords)) return;

    const hadImage = !!article.querySelector('img[alt]:not([alt=""])');
    const placeholder = createPlaceholder(hadImage);

    const container = getTweetContainer(article);

    // Store original node so reveal can restore it
    placeholder._xzenOriginal = container;

    // Measure container height to avoid layout jumps
    const height = container.offsetHeight;
    if (height > 0) {
      placeholder.style.minHeight = `${Math.min(height, 200)}px`;
    }

    container.replaceWith(placeholder);
  }

  // ─── Scan Existing Tweets ────────────────────────────────────────────────────

  function scanAll() {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    articles.forEach(processTweet);
  }

  // ─── MutationObserver ────────────────────────────────────────────────────────

  let observer = null;

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      // Batch: collect new article nodes, then process in one rAF tick
      const newArticles = [];
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Direct article match
          if (node.matches('article[data-testid="tweet"]')) {
            newArticles.push(node);
          } else {
            node.querySelectorAll('article[data-testid="tweet"]').forEach((a) => {
              newArticles.push(a);
            });
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
    if (observer) {
      observer.disconnect();
      observer = null;
    }
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
        // Remove all existing placeholders — restore originals
        document.querySelectorAll('.xzen-placeholder').forEach((ph) => {
          if (ph._xzenOriginal) ph.replaceWith(ph._xzenOriginal);
        });
      }
    }
  });

  // ─── Boot ────────────────────────────────────────────────────────────────────

  loadSettings(() => {
    if (settings.enabled) {
      injectStyles();
      startObserver();
      // Defer initial scan slightly to let the SPA render its first batch
      setTimeout(scanAll, 800);
    }
  });
})();
