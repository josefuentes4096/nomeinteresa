# 001 — Hide articles by title keywords

| Field   | Value       |
| ------- | ----------- |
| Status  | Implemented |
| Version | 0.1.0       |
| Related | —           |

## Context

News portals mix every topic on their home and section pages. A reader who is not interested in some topics (football, celebrity gossip) has to scroll past many articles about them. Sites don't offer a way to mute topics.

## Goals

- Articles whose **title** contains any of the user's keywords disappear from the page, as whole cards (headline, image, summary), with no empty boxes left behind.
- The user chooses on which sites filtering runs; nothing happens on other sites.
- The user can start from predefined keyword sets (Farándula, Fútbol, Automovilismo, Rugby, Tecnoptimistas, Gastronomía, Celebridades) and edit the list freely.
- Works on pages that keep adding articles (infinite scroll, client-side navigation).

## Non-goals

- Matching on summaries, URLs, sections, images or article bodies.
- Site-specific selectors or rules per site.
- Showing hidden articles on the page on demand.
- Syncing settings across devices.

## Behavior

- **R1.** When the user turns on "Hide matching articles on this site" in the popup, the extension shall request host access to that site and its subdomains (`*://*.site/*`); the site is enabled only if access is granted. The site is the tab's host name without a leading `www.`.
- **R2.** When a site is enabled, the extension shall filter tabs already open on it without a reload, and every page loaded on it afterwards.
- **R3.** When the user turns the toggle off, or removes the site's access in `chrome://extensions`, the extension shall stop filtering that site and show its hidden articles again in open tabs.
- **R4.** The extension shall treat as article titles the elements `h2`–`h6` and elements whose class contains "headline" or "title"; when such elements are nested, only the innermost counts. `h1` is never a title, so the article a user opened is never hidden.
- **R5.** Titles that link to the same URL (ignoring `#fragment`) belong to the same article; only the first one (the headline) is checked, and its result applies to every copy of the article on the page.
- **R6.** An article's title is its headline plus its lead-in (kicker, "volanta"): the short text (up to 150 characters) right before the headline inside the same card, such as "La agenda del Xeneize". Bylines, dates and other titles are not lead-ins. The title matches when it contains a keyword as a whole word or phrase, ignoring case, accents and repeated spaces; a phrase never spans lead-in and headline. A keyword written in double quotes (`"Máxima"`, curly quotes accepted) is case-sensitive: it matches only with the same capital letters, still ignoring accents.
- **R7.** When a title matches, the extension shall hide its card: the largest ancestor that contains no other article's title, stopping before `body`, `main`, `[role=main]` and any container with an `h1`.
- **R8.** When the page adds content, the extension shall filter the new articles before they are painted.
- **R9.** When the keyword list changes, open tabs on enabled sites shall re-filter: newly matching articles are hidden and articles that no longer match are shown again.
- **R10.** Keywords are edited in the popup, one per line (commas also separate), and saved automatically. Blanks and duplicates (ignoring accents, and case unless the keyword is quoted) are dropped, curly quotes become straight quotes, and the list is kept in alphabetical order (as are the predefined sets); at most 500 keywords of up to 100 characters.
- **R11.** The popup shall offer the predefined sets "Farándula", "Fútbol", "Automovilismo", "Rugby", "Tecnoptimistas", "Gastronomía" (promotional food awards and rankings) and "Celebridades" (royals and international celebrities); adding one merges its keywords into the list without duplicates and reports how many were added.
- **R12.** When filtering stops on a page, the page shall be left exactly as it was (no attributes or styles from the extension).
- **R13.** The popup shall list the articles hidden on the current tab, each with its lead-in (if any), headline and the keyword that matched it (as the user wrote it; the longest one when keywords overlap), in page order, with their count. Copies of the same article count once. The list refreshes while the popup is open. When filtering is not running on the tab, the popup says so.
- **R14.** The toolbar icon shall show, per tab, the number of hidden articles (the same count as the report) as a red badge with white text: nothing when none are hidden, "99+" above 99. Its tooltip says how many are hidden. The badge is cleared when the tab starts loading another page and set again once that page is filtered.

## Acceptance criteria

| ID   | Criterion                                                                                                                 | Verified by                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| AC1  | On a news portal page with linked headline cards, matching cards are hidden whole and nothing else                        | `tests/e2e/fixtures/portal-cards.html`                                                  |
| AC2  | A summary that mentions a keyword does not hide its article                                                               | `tests/e2e/fixtures/portal-cards.html` (`#deck-only`)                                   |
| AC15 | A lead-in with a keyword hides its article; bylines, long text and the previous article's summary don't count             | `tests/e2e/fixtures/lead-in-cards.html`                                                 |
| AC16 | The popup report lists each hidden article once, with lead-in, matching keyword and count; empty when filtering stops     | `tests/e2e/filter.e2e.js` (report)                                                      |
| AC14 | An article shown twice on the page is hidden in both places                                                               | `tests/e2e/fixtures/portal-cards.html` (`#football-again`)                              |
| AC3  | An article page whose `h1` matches is not hidden; matching related cards are                                              | `tests/e2e/fixtures/generic-cards.html`                                                 |
| AC4  | Cards added after load are hidden                                                                                         | `tests/e2e/filter.e2e.js` (infinite scroll)                                             |
| AC5  | Changing keywords re-filters; clearing them restores the page                                                             | `tests/e2e/filter.e2e.js` (keywords change)                                             |
| AC6  | Nothing happens on sites not enabled; disabling a site restores the page                                                  | `tests/e2e/filter.e2e.js` (sites)                                                       |
| AC7  | Matching ignores case and accents, and only matches whole words or phrases                                                | `tests/filter-core.test.js`                                                             |
| AC17 | The matcher reports the keyword as written, and the longest one when keywords overlap                                     | `tests/filter-core.test.js`                                                             |
| AC18 | A quoted keyword matches only with the same capital letters (`"Máxima"` hides "Máxima visitó…", not "temperatura máxima") | `tests/filter-core.test.js`, `tests/settings.test.js`                                   |
| AC19 | The content script sends the hidden-article count whenever it changes                                                     | `tests/e2e/filter.e2e.js` (badge count)                                                 |
| AC20 | Badge text: empty for 0, the count up to 99, "99+" above                                                                  | `tests/badge.test.js`                                                                   |
| AC21 | The badge shows the count in red on a filtered tab, and clears after navigating to a site that is not enabled             | manual: open a news portal with Fútbol enabled, then go to another site in the same tab |
| AC8  | A site matches its subdomains but not look-alike domains                                                                  | `tests/filter-core.test.js`                                                             |
| AC9  | Keyword input is cleaned (blanks, duplicates, limits); sites are validated                                                | `tests/settings.test.js`                                                                |
| AC10 | Presets are clean keyword lists with localized names                                                                      | `tests/presets.test.js`                                                                 |
| AC11 | Enabling a site asks for access; the toggle stays off if access is denied                                                 | manual: enable a news portal, deny the prompt, reopen the popup                         |
| AC12 | Enabling a site filters the open tab without reload; disabling shows it all back                                          | manual: on a news portal add the Fútbol set, toggle on, check, toggle off               |
| AC13 | Removing site access in `chrome://extensions` disables the site                                                           | manual: Details → Site access → remove the site, reload the tab, articles are visible   |

## Constraints

- No network access; settings stay in `chrome.storage.local`.
- Host access only for enabled sites, requested at runtime (`optional_host_permissions`).
- `chrome.permissions.request` needs a user gesture and the popup may close while Chrome shows the prompt, so the service worker (not the popup) reacts to `permissions.onAdded/onRemoved`.
- Content scripts registered with `chrome.scripting.registerContentScripts` must be classic scripts.

## Design

- `shared/settings.js` — settings keys, validation, site ↔ match pattern.
- `shared/presets.js` — predefined keyword sets.
- `background/service-worker.js` — on permission changes, updates `sites`, registers the content script for granted sites (`runAt: document_end`) and injects it into open tabs.
- `content/filter-core.js` — matching, title and card detection, hiding (pure DOM, no `chrome.*`).
- `content/filter.js` — reads storage, applies the filter, `MutationObserver` for new content, reacts to storage changes.
- `shared/badge.js` — badge text and colors; the service worker sets the badge per tab from the content script's `MessageType.HIDDEN_COUNT` messages, clears it on `tabs.onUpdated` "loading" and asks the page again on "complete".
- `popup/` — site toggle, hidden-articles report (asks the tab's content script with `MessageType.GET_HIDDEN`), keyword list, preset buttons.

Hiding uses an attribute plus one stylesheet rule instead of inline styles, so un-hiding is removing the attribute and the page's own styles are never touched.

## Decision log

- 2026-11-24 — Match on titles only, as requested; summaries mentioning a keyword don't hide the article.
- 2026-11-24 — Generic card detection (title → largest ancestor with no other article) instead of per-site selectors, so it works across news portals without maintenance. Checked against the live home page of a large news portal.
- 2026-11-24 — Tested on the live home pages of three more major news portals. Found and fixed: a second copy of a matching article stayed visible.
- 2026-11-24 — The lead-in counts as part of the title (user decision), after a news portal showed keywords only in lead-ins.
- 2026-11-24 — Added the hidden-articles report in the popup (user request), then the matching keyword per article (user request).
- 2026-11-24 — Added the Automovilismo and Rugby sets and expanded all sets (user request). Left out keywords that hit unrelated news on the live home pages or are common words: "Ferrari" (surname), "Serie A", "FIA" ("fía"), "scrum", "Intrusos", "El Polaco", "Godoy Cruz" (city), "Bielsa" alone (politician), "Pumas" alone, "Mercedes".
- 2026-11-24 — Gastronomía uses phrases ("mejor pizza", "mejores empanadas", "estrellas Michelin") so ordinary food news stays visible. Celebridades covers Máxima with phrases ("reina Máxima", "Zorreguieta", "realeza") because "máxima" alone is a common word ("temperatura máxima").
- 2026-11-24 — Case-sensitive keywords in double quotes (user request), so names that are also common words ("Máxima") can be filtered. A quoted keyword still matches a title that starts with the common word ("Máxima tensión…").
- 2026-11-24 — Red badge with the hidden count on the toolbar icon (user request). Needs no new permission.
- 2026-11-24 — "Boca" alone is not in the Fútbol set because it also means "mouth"; users can add it.
