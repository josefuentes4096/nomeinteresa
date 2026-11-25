// @ts-check
//
// Matching and hiding logic, injected as a classic content script before
// filter.js. Rules for this file (enforced by tests/filter-core.test.js):
// - no import/export and no chrome.* calls, so it also runs in Node (vm) and
//   in a plain page during end-to-end tests;
// - only top-level function declarations (no top-level const/let), so the
//   functions become globals that filter.js can call.

/** Attribute that marks a hidden article. Removing it is all it takes to show it again. */
function hiddenAttribute() {
  return 'data-nomeinteresa-hidden';
}

function hideStyleId() {
  return 'nomeinteresa-hide-style';
}

/**
 * Elements that can hold an article title. `h1` is left out on purpose: it is
 * the main headline of an article page, and hiding it would hide the article
 * the user chose to open.
 */
function titleSelector() {
  return 'h2, h3, h4, h5, h6, [class*="headline" i], [class*="title" i]';
}

/**
 * No accents, single spaces, case kept: "Máxima  Zorreguieta" → "Maxima Zorreguieta".
 *
 * @param {string} text
 */
function foldAccents(text) {
  return String(text).normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim();
}

/**
 * Lower case, no accents, single spaces: "Fútbol  ARGENTINO" → "futbol argentino".
 *
 * @param {string} text
 */
function normalizeForMatch(text) {
  return foldAccents(text).toLowerCase();
}

/**
 * The text of a case-sensitive keyword, written in double quotes ("Máxima",
 * also with curly quotes), or null for an ordinary keyword.
 *
 * @param {string} keyword
 * @returns {string | null}
 */
function caseSensitiveText(keyword) {
  const match = /^\s*["“”](.*)["“”]\s*$/.exec(keyword);
  return match ? match[1].trim() : null;
}

/**
 * A whole-word regex for any of `phrases`, longest first so "Copa América" is
 * reported instead of "Copa" when both are keywords. Null for no phrases.
 *
 * @param {Iterable<string>} phrases
 */
function wholeWordPattern(phrases) {
  const alternatives = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (alternatives.length === 0) return null;
  // Letters or digits on either side mean the keyword is part of a longer word.
  return new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'u');
}

/**
 * Builds a function that finds the first keyword a title contains as a whole
 * word or phrase, ignoring accents. Ordinary keywords also ignore case;
 * keywords in double quotes ("Máxima") must match capital letters exactly. It
 * returns the keyword as the user wrote it, or null if none matches. Returns
 * null (no function) when there is nothing to match.
 *
 * @param {unknown} keywords
 * @returns {KeywordMatcher | null}
 */
function buildKeywordMatcher(keywords) {
  // Normalized form → keyword as written (the first spelling wins).
  /** @type {Map<string, string>} */
  const anyCase = new Map();
  /** @type {Map<string, string>} */
  const exactCase = new Map();
  if (Array.isArray(keywords)) {
    for (const keyword of keywords) {
      if (typeof keyword !== 'string') continue;
      const quoted = caseSensitiveText(keyword);
      const [map, normalized] =
        quoted === null ? [anyCase, normalizeForMatch(keyword)] : [exactCase, foldAccents(quoted)];
      if (normalized && !map.has(normalized)) map.set(normalized, keyword.trim());
    }
  }
  const anyCasePattern = wholeWordPattern(anyCase.keys());
  const exactCasePattern = wholeWordPattern(exactCase.keys());
  if (!anyCasePattern && !exactCasePattern) return null;

  return (title) => {
    const folded = foldAccents(title);
    const candidates = [
      { match: anyCasePattern?.exec(folded.toLowerCase()), map: anyCase },
      { match: exactCasePattern?.exec(folded), map: exactCase },
    ];
    /** @type {string | null} */
    let best = null;
    let bestIndex = Infinity;
    let bestLength = 0;
    for (const { match, map } of candidates) {
      if (!match) continue;
      // The earliest match wins; at the same position, the longer one.
      if (match.index < bestIndex || (match.index === bestIndex && match[0].length > bestLength)) {
        best = map.get(match[0]) ?? match[0];
        bestIndex = match.index;
        bestLength = match[0].length;
      }
    }
    return best;
  };
}

/** @typedef {(title: string) => string | null} KeywordMatcher */

/**
 * Whether filtering is on for `hostname`: it equals an enabled site or is one
 * of its subdomains.
 *
 * @param {string} hostname
 * @param {unknown} sites
 */
function hostMatchesSite(hostname, sites) {
  if (!Array.isArray(sites)) return false;
  const host = String(hostname).toLowerCase();
  return sites.some((site) => typeof site === 'string' && (host === site || host.endsWith(`.${site}`)));
}

/**
 * Title elements in `root`. When candidates are nested (a "card-title" div
 * around an h3), only the innermost one is kept.
 *
 * @param {ParentNode} root
 * @returns {Element[]}
 */
function findArticleTitles(root) {
  const candidates = [...root.querySelectorAll(titleSelector())];
  const selector = titleSelector();
  return candidates.filter((el) => !el.querySelector(selector));
}

/**
 * Identifies the article a title belongs to: the URL it links to (without the
 * #fragment), or the element itself when it has no link. A card's headline and
 * its summary usually share the same link, so they count as one article.
 *
 * @param {Element} title
 * @returns {string | Element}
 */
function articleKey(title) {
  const link = title.closest('a[href]') ?? title.querySelector('a[href]');
  return link ? /** @type {HTMLAnchorElement} */ (link).href.split('#')[0] : title;
}

/** @param {Element} el */
function isLayoutBoundary(el) {
  const doc = el.ownerDocument;
  return el === doc.body || el === doc.documentElement || el.matches('main, [role="main"]');
}

/**
 * The card that holds an article: the largest ancestor of its title that
 * contains no other article's title. Never climbs into the page layout
 * (body, main) or into a container with the page's main headline (h1).
 *
 * @param {Element} title
 * @param {Element[]} titles All titles on the page.
 * @param {Map<Element, string | Element>} keys Article key of each title.
 */
function findArticleCard(title, titles, keys) {
  const key = keys.get(title);
  let card = title;
  for (let parent = card.parentElement; parent && !isLayoutBoundary(parent); parent = parent.parentElement) {
    if (parent.querySelector('h1')) break;
    if (titles.some((other) => keys.get(other) !== key && parent.contains(other))) break;
    card = parent;
  }
  return card;
}

/** Lead-ins are a few words; anything longer is a summary or other content. */
function leadInMaxLength() {
  return 150;
}

/** How far up from the headline to look for the lead-in (e.g. h4 → link → card). */
function leadInMaxDepth() {
  return 3;
}

/** Elements before a headline that are not a lead-in even if short. */
function notLeadInSelector() {
  return 'time, [class*="author" i], [class*="byline" i], [class*="date" i]';
}

/**
 * The headline's lead-in (kicker, "volanta"): the short text right before it in
 * the same card, such as "La agenda del Xeneize" above "Boca ya piensa en…" on
 * some news portals. Returns "" when there is none.
 *
 * Starting at the headline, takes the previous sibling of the nearest element
 * that has one, but only while still inside the article's card, so the summary
 * of the article above in a flat list is never taken as a lead-in.
 *
 * @param {Element} title
 * @param {Element[]} titles All titles on the page.
 * @param {Map<Element, string | Element>} keys Article key of each title.
 */
function findLeadIn(title, titles, keys) {
  const key = keys.get(title);
  let el = title;
  for (let depth = 0; depth < leadInMaxDepth() && el.parentElement; depth++) {
    const parent = el.parentElement;
    if (isLayoutBoundary(parent) || parent.querySelector('h1')) return '';
    if (titles.some((other) => keys.get(other) !== key && parent.contains(other))) return '';
    const sibling = el.previousElementSibling;
    if (sibling) {
      const isOtherContent =
        sibling.matches(`${titleSelector()}, ${notLeadInSelector()}`) ||
        sibling.querySelector(`${titleSelector()}, ${notLeadInSelector()}`);
      const text = (sibling.textContent ?? '').replace(/\s+/g, ' ').trim();
      return !isOtherContent && text.length <= leadInMaxLength() ? text : '';
    }
    el = parent;
  }
  return '';
}

/** @param {Document} doc */
function ensureHideStyle(doc) {
  if (doc.getElementById(hideStyleId())) return;
  const style = doc.createElement('style');
  style.id = hideStyleId();
  style.textContent = `[${hiddenAttribute()}] { display: none !important; }`;
  (doc.head ?? doc.documentElement).append(style);
}

/**
 * Hides every article whose title matches. The title is the first title
 * element of each article (its headline) plus its lead-in, if any. Safe to call
 * repeatedly: hidden articles are skipped.
 *
 * @param {Document} doc
 * @param {KeywordMatcher} matches
 * @returns {HiddenArticle[]} The articles hidden by this call (one entry per card).
 */
function applyKeywordFilter(doc, matches) {
  ensureHideStyle(doc);
  const titles = findArticleTitles(doc);
  const keys = new Map(titles.map((t) => [t, articleKey(t)]));
  /**
   * Verdict per article, decided by its first title (the headline). Later
   * titles of the same article reuse it: a summary never decides on its own,
   * and a second copy of the article elsewhere on the page is hidden too.
   * @type {Map<string | Element, { keyword: string | null, leadIn: string, title: string }>}
   */
  const verdicts = new Map();
  /** @type {HiddenArticle[]} */
  const hidden = [];
  for (const title of titles) {
    const key = keys.get(title);
    if (key === undefined) continue;
    let verdict = verdicts.get(key);
    if (verdict === undefined) {
      const leadIn = findLeadIn(title, titles, keys);
      const text = (title.textContent ?? '').replace(/\s+/g, ' ').trim();
      // The separator is not a letter, so a phrase can't match across lead-in and headline.
      verdict = { keyword: matches(`${leadIn} · ${text}`), leadIn, title: text };
      verdicts.set(key, verdict);
    }
    if (verdict.keyword === null || title.closest(`[${hiddenAttribute()}]`)) continue;
    const card = findArticleCard(title, titles, keys);
    card.setAttribute(hiddenAttribute(), '');
    hidden.push({ key, keyword: verdict.keyword, leadIn: verdict.leadIn, title: verdict.title, card });
  }
  return hidden;
}

/**
 * @typedef {object} HiddenArticle
 * @property {string | Element} key Article identity (see articleKey); copies of an article share it.
 * @property {string} keyword The keyword that matched, as the user wrote it.
 * @property {string} leadIn Lead-in text, or "".
 * @property {string} title Headline text.
 * @property {Element} card The element that was hidden.
 */

/**
 * The articles currently hidden in `doc`, one per article (copies counted
 * once), in page order. Cards the page has since removed are left out.
 *
 * @param {Document} doc
 * @param {WeakMap<Element, HiddenArticle>} hiddenByCard What applyKeywordFilter returned, by card.
 * @returns {{ keyword: string, leadIn: string, title: string }[]}
 */
function listHiddenArticles(doc, hiddenByCard) {
  const seen = new Set();
  /** @type {{ keyword: string, leadIn: string, title: string }[]} */
  const list = [];
  for (const card of doc.querySelectorAll(`[${hiddenAttribute()}]`)) {
    const article = hiddenByCard.get(card);
    if (!article || seen.has(article.key)) continue;
    seen.add(article.key);
    list.push({ keyword: article.keyword, leadIn: article.leadIn, title: article.title });
  }
  return list;
}

/**
 * Shows every hidden article again and removes the extension's style, leaving
 * the page as it was.
 *
 * @param {Document} doc
 */
function clearKeywordFilter(doc) {
  for (const el of doc.querySelectorAll(`[${hiddenAttribute()}]`)) el.removeAttribute(hiddenAttribute());
  doc.getElementById(hideStyleId())?.remove();
}
