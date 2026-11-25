// @ts-check
import { BADGE_COLOR, BADGE_TEXT_COLOR, badgeText } from '../shared/badge.js';
import { t } from '../shared/i18n.js';
import { MessageType } from '../shared/messages.js';
import { loadSettings, saveSites, siteFromPattern, sitePattern } from '../shared/settings.js';

// A site is enabled when the user grants host access to it from the popup,
// and disabled when that access is removed (from the popup or from
// chrome://extensions). The worker turns those permission events into the
// stored site list and the content script registration. Doing this here, not in
// the popup, matters: the popup may close while Chrome shows the permission prompt.

const CONTENT_SCRIPT_ID = 'keyword-filter';
const CONTENT_SCRIPT_FILES = ['content/filter-core.js', 'content/filter.js'];

/** Serializes storage and registration updates so overlapping events can't interleave. */
let queue = Promise.resolve();

/** @param {() => Promise<void>} task */
function enqueue(task) {
  queue = queue.then(task).catch((error) => console.error('[nomeinteresa]', error));
  return queue;
}

/** Registers the content script for exactly the enabled sites that still have host access. */
async function syncContentScripts() {
  const { sites } = await loadSettings();
  /** @type {string[]} */
  const matches = [];
  for (const site of sites) {
    if (await chrome.permissions.contains({ origins: [sitePattern(site)] })) matches.push(sitePattern(site));
  }
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_ID] });
  if (matches.length === 0) return;
  await chrome.scripting.registerContentScripts([
    { id: CONTENT_SCRIPT_ID, matches, js: CONTENT_SCRIPT_FILES, runAt: 'document_end' },
  ]);
}

/**
 * Starts filtering in tabs that are already open on newly enabled sites, so
 * the user doesn't have to reload.
 *
 * @param {string[]} patterns
 */
async function injectIntoOpenTabs(patterns) {
  const tabs = await chrome.tabs.query({ url: patterns });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const target = { tabId: tab.id };
    try {
      const [probe] = await chrome.scripting.executeScript({
        target,
        func: () => /** @type {any} */ (globalThis).__noMeInteresaStarted === true,
      });
      if (!probe?.result) await chrome.scripting.executeScript({ target, files: CONTENT_SCRIPT_FILES });
    } catch (error) {
      // Tabs that can't be scripted (error pages, still loading) get the registered script on next load.
      console.warn('[nomeinteresa] could not inject into tab', tab.id, error);
    }
  }
}

/** @param {chrome.permissions.Permissions} permissions */
function ourSites(permissions) {
  return (permissions.origins ?? []).map(siteFromPattern).filter(Boolean);
}

chrome.permissions.onAdded.addListener((permissions) => {
  const added = ourSites(permissions);
  if (added.length === 0) return;
  enqueue(async () => {
    const { sites } = await loadSettings();
    await saveSites([...sites, ...added]);
    await syncContentScripts();
    await injectIntoOpenTabs(added.map(sitePattern));
  });
});

chrome.permissions.onRemoved.addListener((permissions) => {
  const removed = new Set(ourSites(permissions));
  if (removed.size === 0) return;
  enqueue(async () => {
    const { sites } = await loadSettings();
    // Open tabs on these sites see the storage change and show their articles again.
    await saveSites(sites.filter((site) => !removed.has(site)));
    await syncContentScripts();
  });
});

/**
 * Shows the number of hidden articles on the tab's toolbar icon, in red.
 *
 * @param {number} tabId
 * @param {number} count
 */
async function setBadge(tabId, count) {
  const text = badgeText(count);
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }),
    chrome.action.setBadgeTextColor({ tabId, color: BADGE_TEXT_COLOR }),
    chrome.action.setTitle({ tabId, title: text ? t('badgeTitle', String(count)) : t('actionTitle') }),
  ]);
}

chrome.runtime.onMessage.addListener((message, sender) => {
  // Only this extension's content script, in a tab's top frame.
  const tabId = sender.tab?.id;
  if (sender.id !== chrome.runtime.id || tabId === undefined || sender.frameId !== 0) return;
  if (message?.type !== MessageType.HIDDEN_COUNT) return;
  setBadge(tabId, Number(message.count)).catch((error) => console.warn('[nomeinteresa] badge', error));
});

/**
 * Sets the badge from what the tab's content script reports; a tab without
 * the content script (site not enabled) gets no badge.
 *
 * @param {number} tabId
 */
async function refreshBadge(tabId) {
  /** @type {number} */
  let count;
  try {
    /** @type {import('../shared/messages.js').HiddenReport | undefined} */
    const report = await chrome.tabs.sendMessage(tabId, { type: MessageType.GET_HIDDEN });
    count = report?.articles.length ?? 0;
  } catch {
    count = 0;
  }
  await setBadge(tabId, count);
}

// Tab badges survive navigation: clear the badge when a page starts loading,
// and ask the page for its count once it has loaded (this also covers sites
// that change page without a full reload). In between, the content script
// sends its count whenever it changes.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  const update =
    changeInfo.status === 'loading'
      ? setBadge(tabId, 0)
      : changeInfo.status === 'complete'
        ? refreshBadge(tabId)
        : null;
  update?.catch((error) => console.warn('[nomeinteresa] badge', error));
});

chrome.runtime.onInstalled.addListener(() => enqueue(syncContentScripts));
chrome.runtime.onStartup.addListener(() => enqueue(syncContentScripts));
