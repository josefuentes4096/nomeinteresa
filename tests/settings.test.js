import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_KEYWORD_LENGTH,
  MAX_KEYWORDS,
  normalizeSettings,
  parseKeywords,
  siteFromHostname,
  siteFromPattern,
  sitePattern,
} from '../extension/shared/settings.js';

describe('parseKeywords', () => {
  it('splits on new lines and commas, trims and drops blanks', () => {
    assert.deepEqual(parseKeywords('fútbol, Messi\n\n  Copa   América  \n,'), [
      'Copa América',
      'fútbol',
      'Messi',
    ]);
  });

  it('sorts alphabetically, ignoring case and accents', () => {
    assert.deepEqual(parseKeywords('Messi\nángel de Brito\nzaira\nBoca\nÑandú\nnico'), [
      'ángel de Brito',
      'Boca',
      'Messi',
      'nico',
      'Ñandú',
      'zaira',
    ]);
  });

  it('removes duplicates ignoring case and accents, keeping the first spelling', () => {
    assert.deepEqual(parseKeywords('Fútbol\nfutbol\nFUTBOL'), ['Fútbol']);
  });

  it('keeps case-sensitive keywords in straight quotes, distinct from the plain keyword', () => {
    assert.deepEqual(parseKeywords('“Máxima”\nmáxima\n" Máxima "\n"Maxima"\n""\nboca'), [
      'boca',
      '"Máxima"',
      'máxima',
    ]);
  });

  it('accepts a stored array and ignores non-strings', () => {
    assert.deepEqual(parseKeywords(['boca', 42, null, 'river']), ['boca', 'river']);
  });

  it('returns an empty list for invalid input', () => {
    assert.deepEqual(parseKeywords(undefined), []);
    assert.deepEqual(parseKeywords({}), []);
  });

  it('caps keyword length and count', () => {
    assert.equal(parseKeywords('x'.repeat(500))[0].length, MAX_KEYWORD_LENGTH);
    const many = Array.from({ length: MAX_KEYWORDS + 10 }, (_, i) => `k${i}`).join('\n');
    assert.equal(parseKeywords(many).length, MAX_KEYWORDS);
  });
});

describe('sites', () => {
  it('strips "www." and lower-cases host names', () => {
    assert.equal(siteFromHostname('WWW.Example.com'), 'example.com');
    assert.equal(siteFromHostname('deportes.example.com'), 'deportes.example.com');
  });

  it('rejects things that are not host names', () => {
    for (const bad of ['', '*.example.com', 'exa mple.com', '.com', 'example.', 42]) {
      assert.equal(siteFromHostname(bad), '', String(bad));
    }
  });

  it('round-trips through a match pattern', () => {
    assert.equal(sitePattern('example.com'), '*://*.example.com/*');
    assert.equal(siteFromPattern(sitePattern('example.com')), 'example.com');
  });

  it('ignores patterns the extension did not create', () => {
    assert.equal(siteFromPattern('*://*/*'), '');
    assert.equal(siteFromPattern('https://example.com/*'), '');
  });
});

describe('normalizeSettings', () => {
  it('returns empty settings for invalid input', () => {
    assert.deepEqual(normalizeSettings(null), { keywords: [], sites: [] });
  });

  it('cleans keywords and sites and drops unknown keys', () => {
    assert.deepEqual(
      normalizeSettings({ keywords: [' gol ', 'gol'], sites: ['www.a.com', 'a.com', '*'], x: 1 }),
      {
        keywords: ['gol'],
        sites: ['a.com'],
      },
    );
  });
});
