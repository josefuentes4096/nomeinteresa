// @ts-check

/**
 * Settings live in `chrome.storage.local` under two keys:
 * - `keywords`: string[] — what to hide (matched against article titles).
 * - `sites`: string[] — host names where filtering is on (e.g. "example.com").
 *
 * The content script reads these keys directly, so keep the names in sync with
 * `extension/content/filter.js`.
 *
 * @typedef {object} Settings
 * @property {string[]} keywords
 * @property {string[]} sites
 */

export const STORAGE_KEYS = Object.freeze({ keywords: 'keywords', sites: 'sites' });

/** Keeps the list usable and well inside storage quotas. */
export const MAX_KEYWORDS = 500;
export const MAX_KEYWORD_LENGTH = 100;

/** Splits on new lines and commas, so "fútbol, Messi" and one-per-line both work. */
const KEYWORD_SEPARATOR = /[\n,]/;

/** "Ángel" sorts with A, "ñ" after "n"; lower and upper case together. */
const alphabetical = new Intl.Collator('es', { sensitivity: 'base' });

/** @param {string} text */
const foldAccents = (text) => text.normalize('NFD').replace(/\p{M}/gu, '');

/**
 * A keyword in double quotes ("Máxima") matches capital letters exactly; see
 * caseSensitiveText in extension/content/filter-core.js. Curly quotes are accepted.
 */
const QUOTED = /^["“”](.*)["“”]$/;

/** @param {string} keyword */
const unquote = (keyword) => QUOTED.exec(keyword)?.[1] ?? keyword;

/**
 * Cleans one keyword: single spaces, length limit, straight quotes around a
 * case-sensitive keyword. Returns "" for nothing usable (including `""`).
 *
 * @param {string} raw
 */
function cleanKeyword(raw) {
  const keyword = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_KEYWORD_LENGTH);
  const quoted = QUOTED.exec(keyword);
  if (!quoted) return keyword;
  const text = quoted[1].trim();
  return text ? `"${text}"` : '';
}

/**
 * Identity for duplicates: accents never matter; case matters only for
 * case-sensitive keywords, so `"Máxima"` and `máxima` are different keywords.
 *
 * @param {string} keyword
 */
function duplicateKey(keyword) {
  const quoted = QUOTED.exec(keyword);
  return quoted ? `exact:${foldAccents(quoted[1])}` : `any:${foldAccents(keyword).toLowerCase()}`;
}

/**
 * Turns user input (text or a stored array) into a clean keyword list:
 * trimmed, single-spaced, no empties, no duplicates (see duplicateKey),
 * sorted alphabetically (Spanish rules, ignoring case, accents and quotes).
 *
 * @param {unknown} input
 * @returns {string[]}
 */
export function parseKeywords(input) {
  const parts =
    typeof input === 'string'
      ? input.split(KEYWORD_SEPARATOR)
      : Array.isArray(input)
        ? input.filter((k) => typeof k === 'string')
        : [];
  const seen = new Set();
  /** @type {string[]} */
  const result = [];
  for (const part of parts) {
    const keyword = cleanKeyword(String(part));
    const key = duplicateKey(keyword);
    if (!keyword || seen.has(key)) continue;
    seen.add(key);
    result.push(keyword);
    if (result.length >= MAX_KEYWORDS) break;
  }
  return result.sort((a, b) => alphabetical.compare(unquote(a), unquote(b)) || (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * The site a host name belongs to: lower case, without a leading "www.".
 * Returns "" for anything that is not a plain host name.
 *
 * @param {unknown} hostname
 * @returns {string}
 */
export function siteFromHostname(hostname) {
  if (typeof hostname !== 'string') return '';
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^www\./, '');
  return /^[a-z0-9.-]+$/.test(host) && !host.startsWith('.') && !host.endsWith('.') ? host : '';
}

/**
 * Match pattern covering a site and all its subdomains. Used both for the
 * host permission and for the content script registration.
 *
 * @param {string} site
 */
export function sitePattern(site) {
  return `*://*.${site}/*`;
}

/**
 * Inverse of `sitePattern`; "" for patterns this extension did not create
 * (for example "*://*\/*" if the user grants access to all sites).
 *
 * @param {string} pattern
 */
export function siteFromPattern(pattern) {
  const match = /^\*:\/\/\*\.([^/*]+)\/\*$/.exec(pattern);
  return match ? siteFromHostname(match[1]) : '';
}

/**
 * @param {unknown} raw
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const input = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const sites = Array.isArray(input.sites) ? input.sites.map(siteFromHostname).filter(Boolean) : [];
  return { keywords: parseKeywords(input.keywords), sites: [...new Set(sites)] };
}

/** @returns {Promise<Settings>} */
export async function loadSettings() {
  return normalizeSettings(await chrome.storage.local.get([STORAGE_KEYS.keywords, STORAGE_KEYS.sites]));
}

/** @param {unknown} keywords */
export async function saveKeywords(keywords) {
  await chrome.storage.local.set({ [STORAGE_KEYS.keywords]: parseKeywords(keywords) });
}

/** @param {string[]} sites */
export async function saveSites(sites) {
  await chrome.storage.local.set({ [STORAGE_KEYS.sites]: normalizeSettings({ sites }).sites });
}
