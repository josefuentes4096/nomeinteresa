// Fake chrome.* API for the store screenshots, injected into every frame
// before page scripts run (scripts/store-assets.js). It lets the real popup
// and the real content scripts run in a normal page. Configuration comes from
// window.__STORE_CONFIG, set by the generator: { lang, messages, keywords, report }.
(() => {
  const config = window.__STORE_CONFIG;
  const filterOff = new URLSearchParams(location.search).get('filter') === 'off';
  const DEMO_SITE = 'diario.example';
  const listeners = [];

  window.chrome = {
    i18n: {
      getUILanguage: () => config.lang,
      getMessage(key, substitutions) {
        const entry = config.messages[key];
        if (!entry) return '';
        const values = [].concat(substitutions ?? []);
        let text = entry.message;
        for (const [name, placeholder] of Object.entries(entry.placeholders ?? {})) {
          const value = values[Number(placeholder.content.slice(1)) - 1] ?? '';
          text = text.split(`$${name.toUpperCase()}$`).join(value);
        }
        return text;
      },
    },
    storage: {
      local: {
        get: async () => ({
          keywords: config.keywords,
          sites: filterOff ? [] : [location.hostname, DEMO_SITE],
        }),
        set: async () => {},
      },
      onChanged: { addListener() {} },
    },
    runtime: {
      id: 'store-assets',
      onMessage: { addListener: (fn) => listeners.push(fn) },
      sendMessage: async () => {},
    },
    tabs: {
      query: async () => [{ id: 1, url: `https://${DEMO_SITE}/` }],
      sendMessage: async () => config.report,
    },
    permissions: { contains: async () => true },
  };

  // Screenshots look cleaner without page scrollbars (inner lists keep theirs).
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = 'html { scrollbar-width: none; }';
    document.head.append(style);
  });

  // Lets the generator read the content script's real report from the demo page.
  window.__askContentScript = (message) =>
    new Promise((resolve) => listeners[0]?.(message, { id: 'store-assets' }, resolve));
})();
