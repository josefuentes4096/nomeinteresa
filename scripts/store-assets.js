// Generates the Chrome Web Store images in store/images/ from HTML layouts
// (store/assets-src/), rendered by headless Chrome at the exact sizes the
// store requires. The popup and the content scripts are the real extension
// code, running against a stubbed chrome API, on a fictional news page.
//
// Usage: npm run store-assets   (needs Chrome; set CHROME_PATH if not found)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome, serveDirectory, sleep } from '../tests/e2e/chrome.js';
import { MessageType } from '../extension/shared/messages.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const outDir = join(root, 'store', 'images');
/** Time for iframes, fonts and the content script to settle before capturing. */
const RENDER_MS = 1500;

/** Keywords shown in the screenshots; they match the fictional demo headlines. */
const KEYWORDS = ['farándula', 'Fórmula 1', 'fútbol', 'mejor pizza', 'rugby'];

const CAPTIONS = {
  en: {
    filteredTitle: 'Hide the news you are not interested in',
    filteredSubtitle: 'Articles whose headline matches your keywords disappear, on the sites you choose.',
    beforeAfterTitle: 'A cleaner front page',
    beforeAfterSubtitle: 'Whole cards go away: headline, image and lead-in, with no gaps left behind.',
    before: 'Before',
    after: 'After',
    popupTitle: 'Your keywords, your rules',
    popupSubtitle: 'Everything happens in your browser. Nothing is sent anywhere.',
    features: [
      'Ready-made keyword sets: celebrity gossip, football, motorsport, rugby, food awards and more',
      'The short lead-in above a headline counts as part of the title',
      '"Quoted" keywords match capital letters exactly',
      'See every hidden article and the keyword that hid it',
      'A red badge on the toolbar icon counts hidden articles',
    ],
    tagline: 'Hide the news you are not interested in',
  },
  es: {
    filteredTitle: 'Oculta las noticias que no te interesan',
    filteredSubtitle:
      'Desaparecen los artículos cuyo título contiene tus palabras clave, en los sitios que elijas.',
    beforeAfterTitle: 'Una portada más limpia',
    beforeAfterSubtitle: 'Se van las tarjetas enteras: titular, imagen y volanta, sin dejar huecos.',
    before: 'Antes',
    after: 'Después',
    popupTitle: 'Tus palabras, tus reglas',
    popupSubtitle: 'Todo ocurre en tu navegador. No se envía nada a ningún lado.',
    features: [
      'Conjuntos listos: farándula, fútbol, automovilismo, rugby, gastronomía y más',
      'La volanta sobre el titular cuenta como parte del título',
      'Las palabras "entre comillas" respetan las mayúsculas',
      'Mira cada artículo oculto y la palabra que lo ocultó',
      'Un contador rojo en el icono muestra cuántos se ocultaron',
    ],
    tagline: 'Oculta las noticias que no te interesan',
  },
};

const IMAGES = [
  { layout: 'filtered', file: 'screenshot-1-filtered.png', width: 1280, height: 800 },
  { layout: 'before-after', file: 'screenshot-2-before-after.png', width: 1280, height: 800 },
  { layout: 'popup', file: 'screenshot-3-popup.png', width: 1280, height: 800 },
  { layout: 'promo', file: 'promo-small-440x280.png', width: 440, height: 280 },
];

const stub = await readFile(join(root, 'store', 'assets-src', 'stub.js'), 'utf8');
const server = await serveDirectory(root);
const chrome = await launchChrome();

/**
 * Opens `path` in a new tab of the given size, with the chrome stub configured
 * by `config`, and returns helpers to evaluate and capture.
 */
async function openWithStub(path, config, width, height, transparent = false) {
  const { browser } = chrome;
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  if (transparent) {
    await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  }
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `window.__STORE_CONFIG = ${JSON.stringify(config)};\n${stub}`,
  });
  await send('Page.navigate', { url: `${server.baseUrl}${path}` });
  await sleep(RENDER_MS);
  return {
    async evaluate(expression) {
      const { result } = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      return result.value;
    },
    async capture(file) {
      // Screenshot 1 shows the top of the popup; the popup screenshot is scrolled
      // to the bottom to show the keyword sets (no-op on other layouts).
      await send('Runtime.evaluate', {
        expression: "document.getElementById('scrolled')?.contentWindow.scrollTo(0, 100000)",
      });
      await sleep(200);
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      await writeFile(file, Buffer.from(data, 'base64'));
    },
    close: () => browser.send('Target.closeTarget', { targetId }),
  };
}

try {
  for (const lang of ['en', 'es']) {
    const messages = JSON.parse(
      await readFile(join(root, 'extension', '_locales', lang, 'messages.json'), 'utf8'),
    );
    const base = { lang, messages, keywords: KEYWORDS, captions: CAPTIONS[lang] };

    // Ask the real content script on the demo page what it hid, so the popup's
    // report and the badge in the images match the page exactly.
    const demo = await openWithStub('/store/assets-src/demo.html', { ...base, report: null }, 1200, 800);
    const report = await demo.evaluate(
      `window.__askContentScript({ type: ${JSON.stringify(MessageType.GET_HIDDEN)} })`,
    );
    await demo.close();
    if (!report?.articles?.length)
      throw new Error('The demo page hid nothing: check KEYWORDS and demo.html.');

    const config = { ...base, report, badge: String(report.articles.length) };
    await mkdir(join(outDir, lang), { recursive: true });
    for (const image of IMAGES) {
      const page = await openWithStub(
        `/store/assets-src/screenshot.html?layout=${image.layout}`,
        config,
        image.width,
        image.height,
      );
      await page.capture(join(outDir, lang, image.file));
      await page.close();
      console.log(`store/images/${lang}/${image.file}`);
    }
  }

  const icon = await openWithStub(
    '/store/assets-src/screenshot.html?layout=icon',
    { captions: CAPTIONS.en },
    128,
    128,
    true,
  );
  await icon.capture(join(outDir, 'icon-128.png'));
  await icon.close();
  console.log('store/images/icon-128.png');
} finally {
  await chrome.close();
  await server.close();
}
