import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it } from 'node:test';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const manifest = readJson('../extension/manifest.json');
const pkg = readJson('../package.json');
const locales = readdirSync(new URL('../extension/_locales/', import.meta.url));

/** Chrome Web Store / manifest limits. */
const MAX_NAME = 75;
const MAX_DESCRIPTION = 132;

describe('manifest, ready for the Chrome Web Store', () => {
  it('has the same version as package.json', () => {
    assert.equal(manifest.version, pkg.version);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  });

  for (const locale of locales) {
    it(`"${locale}" name and description fit the store limits`, () => {
      const messages = readJson(`../extension/_locales/${locale}/messages.json`);
      assert.ok(messages.extName.message.length <= MAX_NAME, 'name too long');
      assert.ok(messages.extDescription.message.length <= MAX_DESCRIPTION, 'description too long');
    });
  }

  it('requests no host access at install', () => {
    assert.equal(manifest.host_permissions, undefined);
    assert.equal(manifest.content_scripts, undefined);
    assert.deepEqual(manifest.optional_host_permissions, ['*://*/*']);
  });

  it('declares only the permissions documented in the READMEs and the store answers', () => {
    assert.deepEqual([...manifest.permissions].sort(), ['activeTab', 'scripting', 'storage']);
  });
});

describe('manifest, shared by Chrome and Firefox', () => {
  /** Chrome accepts `background.scripts` next to `service_worker` in Manifest V3 from version 121. */
  const MIN_CHROME_WITH_BACKGROUND_SCRIPTS = 121;

  it('runs the same background script as a service worker (Chrome) and a background script (Firefox)', () => {
    assert.deepEqual(manifest.background.scripts, [manifest.background.service_worker]);
    assert.equal(manifest.background.type, 'module');
  });

  it('requires a Chrome version that accepts both background keys', () => {
    assert.ok(Number(manifest.minimum_chrome_version) >= MIN_CHROME_WITH_BACKGROUND_SCRIPTS);
  });

  it('keeps the Firefox add-on ID (it can never change once published)', () => {
    assert.equal(manifest.browser_specific_settings.gecko.id, 'nomeinteresa@josefuentes4096');
  });

  it('declares to Firefox that it collects no data, with minimum versions that support the declaration', () => {
    const { gecko, gecko_android: android } = manifest.browser_specific_settings;
    assert.deepEqual(gecko.data_collection_permissions, { required: ['none'] });
    assert.ok(parseFloat(gecko.strict_min_version) >= 140);
    assert.ok(parseFloat(android.strict_min_version) >= 142);
  });
});
