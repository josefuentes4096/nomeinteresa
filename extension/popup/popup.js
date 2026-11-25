// @ts-check
import { localizeDocument, t } from '../shared/i18n.js';
import { MessageType } from '../shared/messages.js';
import { KEYWORD_PRESETS } from '../shared/presets.js';
import {
  loadSettings,
  parseKeywords,
  saveKeywords,
  siteFromHostname,
  sitePattern,
} from '../shared/settings.js';

/** @typedef {import('../shared/presets.js').KeywordPreset} KeywordPreset */
/** @typedef {import('../shared/messages.js').HiddenReport} HiddenReport */

/** Waits for a pause in typing before saving, so pages don't re-filter on every key. */
const SAVE_DELAY_MS = 400;
/** Keeps the report current while the page loads more articles or settings change. */
const REPORT_REFRESH_MS = 1000;

/**
 * @template {HTMLElement} T
 * @param {string} id
 * @returns {T}
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return /** @type {T} */ (el);
}

const ui = {
  site: byId('site'),
  siteEnabled: /** @type {HTMLInputElement} */ (byId('siteEnabled')),
  keywords: /** @type {HTMLTextAreaElement} */ (byId('keywords')),
  presets: byId('presets'),
  hiddenHeading: byId('hiddenHeading'),
  hiddenEmpty: byId('hiddenEmpty'),
  hiddenList: byId('hiddenList'),
  status: byId('status'),
};

/**
 * @param {string} text
 * @param {{ error?: boolean }} [opts]
 */
function setStatus(text, { error = false } = {}) {
  ui.status.textContent = text;
  ui.status.classList.toggle('error', error);
}

/** @returns {Promise<chrome.tabs.Tab | undefined>} */
async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

/**
 * @param {chrome.tabs.Tab | undefined} tab
 * @returns {string} The tab's site, or "" if it can't be filtered.
 */
function siteOf(tab) {
  if (!tab?.url) return '';
  const url = new URL(tab.url);
  return url.protocol === 'http:' || url.protocol === 'https:' ? siteFromHostname(url.hostname) : '';
}

/**
 * Asks the tab's content script what it hid. A tab without the content script
 * (site not enabled, page not reloaded yet) has nothing hidden.
 *
 * @param {number} tabId
 * @returns {Promise<HiddenReport>}
 */
async function fetchReport(tabId) {
  try {
    /** @type {HiddenReport | undefined} */
    const report = await chrome.tabs.sendMessage(tabId, { type: MessageType.GET_HIDDEN });
    return report ?? { active: false, articles: [] };
  } catch {
    return { active: false, articles: [] };
  }
}

/** Last rendered report, so polling only touches the DOM when something changed. */
let renderedReport = '';

/** @param {HiddenReport} report */
function renderReport(report) {
  const serialized = JSON.stringify(report);
  if (serialized === renderedReport) return;
  renderedReport = serialized;

  ui.hiddenHeading.textContent = t('popupHiddenHeading', String(report.articles.length));
  ui.hiddenEmpty.textContent =
    report.articles.length > 0 ? '' : t(report.active ? 'popupHiddenNone' : 'popupHiddenInactive');
  ui.hiddenEmpty.hidden = report.articles.length > 0;
  ui.hiddenList.replaceChildren(
    ...report.articles.map(({ keyword, leadIn, title }) => {
      const item = document.createElement('li');
      if (leadIn) {
        const lead = document.createElement('span');
        lead.className = 'lead-in';
        lead.textContent = leadIn;
        item.append(lead);
      }
      const tag = document.createElement('span');
      tag.className = 'keyword';
      tag.textContent = keyword;
      tag.title = t('popupMatchedKeyword', keyword);
      tag.setAttribute('aria-label', tag.title);
      item.append(title, ' ', tag);
      return item;
    }),
  );
}

/** @param {number | undefined} tabId */
async function refreshReport(tabId) {
  renderReport(tabId === undefined ? { active: false, articles: [] } : await fetchReport(tabId));
}

/**
 * Enabling a site is granting host access to it; the service worker reacts to
 * the permission change (see background/service-worker.js).
 *
 * @param {string} site
 */
async function onSiteToggle(site) {
  const origins = [sitePattern(site)];
  try {
    if (ui.siteEnabled.checked) {
      // Must be the first call in the click handler: Chrome requires a user gesture.
      const granted = await chrome.permissions.request({ origins });
      ui.siteEnabled.checked = granted;
      setStatus(granted ? t('statusSiteEnabled', site) : t('statusPermissionDenied'), { error: !granted });
    } else {
      await chrome.permissions.remove({ origins });
      setStatus(t('statusSiteDisabled', site));
    }
  } catch (error) {
    ui.siteEnabled.checked = !ui.siteEnabled.checked;
    setStatus(t('errorUnknown', String(error)), { error: true });
  }
}

/** @type {ReturnType<typeof setTimeout> | undefined} */
let saveTimer;

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveKeywords(ui.keywords.value)
      .then(() => setStatus(t('statusSaved')))
      .catch((error) => setStatus(t('errorUnknown', String(error)), { error: true }));
  }, SAVE_DELAY_MS);
}

/**
 * Merges a preset into the list and saves right away.
 *
 * @param {KeywordPreset} preset
 */
async function addPreset(preset) {
  clearTimeout(saveTimer);
  const before = parseKeywords(ui.keywords.value);
  const after = parseKeywords([...before, ...preset.keywords]);
  ui.keywords.value = after.join('\n');
  try {
    await saveKeywords(after);
    setStatus(t('statusPresetAdded', [String(after.length - before.length), t(preset.labelKey)]));
  } catch (error) {
    setStatus(t('errorUnknown', String(error)), { error: true });
  }
}

function renderPresets() {
  ui.presets.replaceChildren(
    ...KEYWORD_PRESETS.map((preset) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `+ ${t(preset.labelKey)}`;
      button.title = preset.keywords.join(', ');
      button.addEventListener('click', () => addPreset(preset));
      return button;
    }),
  );
}

async function init() {
  localizeDocument();
  ui.keywords.placeholder = t('popupKeywordsPlaceholder');
  renderPresets();

  const [settings, tab] = await Promise.all([loadSettings(), currentTab()]);
  const site = siteOf(tab);
  ui.keywords.value = settings.keywords.join('\n');

  await refreshReport(tab?.id);
  setInterval(() => refreshReport(tab?.id), REPORT_REFRESH_MS);

  if (site) {
    ui.site.textContent = site;
    ui.siteEnabled.checked =
      settings.sites.includes(site) && (await chrome.permissions.contains({ origins: [sitePattern(site)] }));
    ui.siteEnabled.addEventListener('change', () => onSiteToggle(site));
  } else {
    ui.site.textContent = t('popupSiteUnavailable');
    ui.siteEnabled.disabled = true;
  }

  ui.keywords.addEventListener('input', scheduleSave);
  // Show the cleaned-up list (duplicates and blanks removed) once the user leaves the field.
  ui.keywords.addEventListener('blur', () => {
    ui.keywords.value = parseKeywords(ui.keywords.value).join('\n');
  });
}

init().catch((error) => {
  console.error('[popup] init failed', error);
  setStatus(t('errorUnknown', String(error)), { error: true });
});
