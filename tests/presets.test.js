import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { KEYWORD_PRESETS } from '../extension/shared/presets.js';
import { parseKeywords } from '../extension/shared/settings.js';

const messages = JSON.parse(
  readFileSync(new URL('../extension/_locales/en/messages.json', import.meta.url), 'utf8'),
);

describe('keyword presets', () => {
  it('have unique ids', () => {
    const ids = KEYWORD_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  for (const preset of KEYWORD_PRESETS) {
    it(`"${preset.id}" has a localized name`, () => {
      assert.ok(preset.labelKey in messages, preset.labelKey);
    });

    it(`"${preset.id}" is already a clean, alphabetically sorted keyword list (no blanks, duplicates or commas)`, () => {
      assert.ok(preset.keywords.length > 0);
      assert.deepEqual(parseKeywords([...preset.keywords]), [...preset.keywords]);
      for (const keyword of preset.keywords) assert.doesNotMatch(keyword, /,/, keyword);
    });
  }
});
