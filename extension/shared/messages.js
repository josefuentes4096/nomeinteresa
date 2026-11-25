// @ts-check

/**
 * Messages between extension pages and the content script. Keep this the
 * single source of truth for message names; the content script is a classic
 * script and repeats the value (see extension/content/filter.js).
 */
export const MessageType = Object.freeze({
  /** popup → content script: `{ type }` → `HiddenReport` */
  GET_HIDDEN: 'nomeinteresa:get-hidden',
  /** content script → service worker: `{ type, count: number }`, sent when the count changes. */
  HIDDEN_COUNT: 'nomeinteresa:hidden-count',
});

/**
 * @typedef {object} HiddenReport
 * @property {boolean} active Whether filtering is running on the page.
 * @property {{ keyword: string, leadIn: string, title: string }[]} articles Hidden articles, in page
 *   order, with the keyword that matched each one.
 */
