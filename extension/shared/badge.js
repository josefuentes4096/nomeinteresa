// @ts-check

/** Notification red, readable with white text. */
export const BADGE_COLOR = '#d93025';
export const BADGE_TEXT_COLOR = '#ffffff';

/** The badge fits about four characters; larger counts are capped. */
const MAX_SHOWN = 99;

/**
 * Text for the toolbar badge: nothing when no article is hidden, the count up
 * to 99, then "99+".
 *
 * @param {unknown} count
 * @returns {string}
 */
export function badgeText(count) {
  const n = Number(count);
  if (!Number.isInteger(n) || n <= 0) return '';
  return n > MAX_SHOWN ? `${MAX_SHOWN}+` : String(n);
}
