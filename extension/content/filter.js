// @ts-check
/* global buildKeywordMatcher, hostMatchesSite, applyKeywordFilter, clearKeywordFilter, listHiddenArticles */
//
// Content script entry point (classic script, injected after filter-core.js).
// Reads the settings, filters the page, keeps filtering as the page adds
// articles (infinite scroll, client-side navigation), reacts to settings
// changes without a reload, tells the popup what it hid and keeps the
// toolbar badge count up to date.

(() => {
  const state = /** @type {{ __noMeInteresaStarted?: boolean }} */ (/** @type {unknown} */ (globalThis));
  // The service worker may inject into a tab that already runs this script.
  if (state.__noMeInteresaStarted) return;
  state.__noMeInteresaStarted = true;

  /** Must match STORAGE_KEYS in extension/shared/settings.js. */
  const KEYS = ['keywords', 'sites'];
  /** Must match MessageType.GET_HIDDEN in extension/shared/messages.js. */
  const GET_HIDDEN = 'nomeinteresa:get-hidden';
  /** Must match MessageType.HIDDEN_COUNT in extension/shared/messages.js. */
  const HIDDEN_COUNT = 'nomeinteresa:hidden-count';

  /** @type {MutationObserver | null} */
  let observer = null;
  /** What was hidden, by card, for the popup's report. Cards the page removes drop out. */
  /** @type {WeakMap<Element, HiddenArticle>} */
  let hiddenByCard = new WeakMap();
  /** Last count sent for the badge; null forces the next send. */
  /** @type {number | null} */
  let announcedCount = null;

  /** Tells the service worker how many articles are hidden, when that number changes. */
  function announceCount() {
    const count = listHiddenArticles(document, hiddenByCard).length;
    if (count === announcedCount) return;
    announcedCount = count;
    // Fails only while the extension reloads; the next change sends it again.
    chrome.runtime.sendMessage({ type: HIDDEN_COUNT, count }).catch(() => (announcedCount = null));
  }

  /** @param {KeywordMatcher} matches */
  function filter(matches) {
    for (const article of applyKeywordFilter(document, matches)) hiddenByCard.set(article.card, article);
    announceCount();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    clearKeywordFilter(document);
    hiddenByCard = new WeakMap();
  }

  /** @param {KeywordMatcher | null} matches */
  function start(matches) {
    stop();
    if (!matches) {
      announceCount();
      return;
    }
    filter(matches);
    // Runs before the next paint, so new articles are hidden before they show.
    // Only childList is observed: the filter's own attribute changes don't retrigger it.
    observer = new MutationObserver(() => filter(matches));
    observer.observe(document.body ?? document.documentElement, { childList: true, subtree: true });
  }

  async function refresh() {
    const { keywords, sites } = await chrome.storage.local.get(KEYS);
    start(hostMatchesSite(location.hostname, sites) ? buildKeywordMatcher(keywords) : null);
  }

  const report = (/** @type {unknown} */ error) => console.error('[nomeinteresa] refresh failed', error);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && KEYS.some((key) => key in changes)) refresh().catch(report);
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.type !== GET_HIDDEN) return;
    sendResponse({ active: observer !== null, articles: listHiddenArticles(document, hiddenByCard) });
  });

  // A page restored from the back/forward cache keeps this script's state, but
  // Chrome may have reset the badge in the meantime.
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    announcedCount = null;
    announceCount();
  });

  refresh().catch(report);
})();
