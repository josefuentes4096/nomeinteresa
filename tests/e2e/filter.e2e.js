// End-to-end tests: run the real content scripts (filter-core.js + filter.js)
// in headless Chrome on pages that reproduce real news-site markup. The
// chrome.storage and chrome.runtime APIs are replaced by a small in-page stub so the tests can
// change settings like the popup does. Run with `npm run test:e2e`.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { MessageType } from '../../extension/shared/messages.js';
import { launchChrome, openPage, serveDirectory, sleep } from './chrome.js';

const KEYWORDS = ['fútbol', 'Messi'];
/** Content scripts read storage asynchronously; this is plenty for a local page. */
const SETTLE_MS = 200;

const contentScripts = await Promise.all(
  ['filter-core.js', 'filter.js'].map((file) =>
    readFile(new URL(`../../extension/content/${file}`, import.meta.url), 'utf8'),
  ),
);

/**
 * Installs a fake `chrome.storage` holding `settings`, then injects the
 * content scripts in the order the service worker registers them.
 */
async function startFilter(page, settings) {
  await page.run((initial) => {
    const listeners = [];
    const data = { ...initial };
    const fake = {
      storage: {
        local: { get: async (keys) => Object.fromEntries(keys.map((k) => [k, data[k]])) },
        onChanged: { addListener: (fn) => listeners.push(fn) },
      },
      runtime: {
        id: 'nomeinteresa-test',
        onMessage: { addListener: (fn) => (window.__onMessage = fn) },
        // Messages the content script sends to the service worker (badge count).
        sendMessage: async (message) => void window.__sentMessages.push(message),
      },
    };
    window.__sentMessages = [];
    // Test hook: send a message as the popup would and return the response.
    window.__sendMessage = (message) =>
      new Promise((resolve) => window.__onMessage(message, { id: 'nomeinteresa-test' }, resolve));
    // Test hook: update storage and notify listeners, as chrome.storage.local.set would.
    window.__setSettings = (changes) => {
      Object.assign(data, changes);
      const diff = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, { newValue: v }]));
      for (const fn of listeners) fn(diff, 'local');
    };
    Object.defineProperty(window, 'chrome', { value: fake, configurable: true, writable: true });
  }, settings);
  for (const script of contentScripts) await page.evaluate(script);
  await sleep(SETTLE_MS);
}

/** Elements whose data-expect doesn't match their state. */
function wrongExpectations(page) {
  return page.run(() =>
    [...document.querySelectorAll('[data-expect]')]
      .filter((el) => {
        const hidden = el.closest('[data-nomeinteresa-hidden]') !== null && el.offsetParent === null;
        return hidden !== (el.getAttribute('data-expect') === 'hidden');
      })
      .map((el) => `#${el.id} should be ${el.getAttribute('data-expect')}`),
  );
}

const countHidden = (page) => page.run(() => document.querySelectorAll('[data-nomeinteresa-hidden]').length);

describe('content scripts in real Chrome', { timeout: 120_000 }, () => {
  let chrome;
  let server;
  let site;

  before(async () => {
    server = await serveDirectory(fileURLToPath(new URL('./fixtures/', import.meta.url)));
    site = new URL(server.baseUrl).hostname;
    chrome = await launchChrome();
  });

  after(async () => {
    await chrome?.close();
    await server?.close();
  });

  /** @param {string} fixture */
  async function withPage(fixture, fn) {
    const page = await openPage(chrome.browser, `${server.baseUrl}/${fixture}.html`);
    try {
      await fn(page);
    } finally {
      await page.close();
    }
  }

  for (const [fixture, description] of [
    ['portal-cards', 'a news portal home page with linked headline cards'],
    ['generic-cards', 'article cards and an article page with a matching h1'],
    ['lead-in-cards', 'a page where lead-ins count as part of the title'],
  ]) {
    it(`hides whole matching cards, and only those, on ${description}`, () =>
      withPage(fixture, async (page) => {
        await startFilter(page, { sites: [site], keywords: KEYWORDS });
        assert.deepEqual(await wrongExpectations(page), []);
      }));
  }

  it('hides matching articles added later (infinite scroll)', () =>
    withPage('portal-cards', async (page) => {
      await startFilter(page, { sites: [site], keywords: KEYWORDS });
      const hidden = await page.run(async () => {
        const item = document.createElement('div');
        item.className = 'grid-item';
        item.innerHTML =
          '<a href="/deportes/nuevo/" class="card-link"><h2 class="headline">Fútbol: nueva fecha</h2></a>';
        document.querySelector('.grid-row').append(item);
        await new Promise((resolve) => requestAnimationFrame(resolve));
        return item.hasAttribute('data-nomeinteresa-hidden');
      });
      assert.equal(hidden, true);
    }));

  it('re-filters when keywords change, and restores the page when they are cleared', () =>
    withPage('portal-cards', async (page) => {
      await startFilter(page, { sites: [site], keywords: KEYWORDS });
      assert.equal(await countHidden(page), 3);

      await page.run(() => window.__setSettings({ keywords: ['recesión'] }));
      await sleep(SETTLE_MS);
      assert.deepEqual(
        await page.run(() => [...document.querySelectorAll('[data-nomeinteresa-hidden]')].map((el) => el.id)),
        ['economy'],
      );

      await page.run(() => window.__setSettings({ keywords: [] }));
      await sleep(SETTLE_MS);
      assert.equal(await countHidden(page), 0);
      assert.equal(await page.run(() => document.getElementById('nomeinteresa-hide-style')), null);
    }));

  it('does nothing on sites that are not enabled, and stops when a site is disabled', () =>
    withPage('portal-cards', async (page) => {
      await startFilter(page, { sites: ['news.example'], keywords: KEYWORDS });
      assert.equal(await countHidden(page), 0);

      await page.run((s) => window.__setSettings({ sites: ['news.example', s] }), site);
      await sleep(SETTLE_MS);
      assert.equal(await countHidden(page), 3);

      await page.run(() => window.__setSettings({ sites: ['news.example'] }));
      await sleep(SETTLE_MS);
      assert.equal(await countHidden(page), 0);
    }));

  it('sends the badge count to the service worker when it changes', () =>
    withPage('portal-cards', async (page) => {
      const counts = () =>
        page.run(
          (type) => window.__sentMessages.filter((m) => m.type === type).map((m) => m.count),
          MessageType.HIDDEN_COUNT,
        );
      await startFilter(page, { sites: [site], keywords: KEYWORDS });
      // Three cards hidden, two articles (one appears twice): the badge counts articles.
      assert.deepEqual(await counts(), [2]);

      await page.run(() => {
        const item = document.createElement('div');
        item.innerHTML = '<a href="/deportes/otra/"><h2 class="headline">Messi volvió a entrenar</h2></a>';
        document.querySelector('.grid-row').append(item);
      });
      await sleep(SETTLE_MS);
      assert.deepEqual(await counts(), [2, 3]);

      await page.run(() => window.__setSettings({ keywords: [] }));
      await sleep(SETTLE_MS);
      assert.deepEqual(await counts(), [2, 3, 0]);
    }));

  it('reports each hidden article once, with its lead-in and matching keyword, to the popup', async () => {
    const getReport = (page) => page.run((type) => window.__sendMessage({ type }), MessageType.GET_HIDDEN);

    await withPage('portal-cards', async (page) => {
      await startFilter(page, { sites: [site], keywords: KEYWORDS });
      // Three cards are hidden, but two are copies of the same article.
      assert.deepEqual(await getReport(page), {
        active: true,
        articles: [
          { keyword: 'fútbol', leadIn: '', title: 'El FÚTBOL argentino define al campeón' },
          { keyword: 'Messi', leadIn: '', title: 'Messi renovó con su club' },
        ],
      });
      await page.run(() => window.__setSettings({ keywords: [] }));
      await sleep(SETTLE_MS);
      assert.deepEqual(await getReport(page), { active: false, articles: [] });
    });

    await withPage('lead-in-cards', async (page) => {
      await startFilter(page, { sites: [site], keywords: KEYWORDS });
      assert.deepEqual(await getReport(page), {
        active: true,
        articles: [
          {
            keyword: 'fútbol',
            leadIn: 'La agenda del fútbol sigue cargada',
            title: 'Ya piensan en el próximo rival del domingo',
          },
        ],
      });
    });
  });
});
