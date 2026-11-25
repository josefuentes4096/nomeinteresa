import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';

// filter-core.js is a classic content script: load it the way Chrome does
// (as a script, with no chrome.* API available) and read its globals.
const source = readFileSync(new URL('../extension/content/filter-core.js', import.meta.url), 'utf8');
const core = vm.createContext({});
vm.runInContext(source, core);
const { buildKeywordMatcher, hostMatchesSite, normalizeForMatch } = core;

describe('filter-core.js', () => {
  it('is a classic script with no imports, exports or chrome.* calls', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    assert.doesNotMatch(code, /^\s*(import|export)\s/m);
    assert.doesNotMatch(code, /\bchrome\./);
  });

  it('declares nothing at the top level except functions (safe to share one isolated world)', () => {
    assert.doesNotMatch(source, /^(const|let|var|class)\s/m);
  });
});

describe('normalizeForMatch', () => {
  it('removes accents, lower-cases and collapses spaces', () => {
    assert.equal(normalizeForMatch('  Fútbol   ARGENTINO\n'), 'futbol argentino');
    assert.equal(normalizeForMatch('Ñandú'), 'nandu');
  });
});

describe('buildKeywordMatcher', () => {
  it('returns null when there are no usable keywords', () => {
    assert.equal(buildKeywordMatcher([]), null);
    assert.equal(buildKeywordMatcher(['', '  ', 3]), null);
    assert.equal(buildKeywordMatcher('fútbol'), null);
  });

  it('matches titles ignoring case and accents in either side', () => {
    const matches = buildKeywordMatcher(['fútbol']);
    assert.ok(matches('El FUTBOL argentino vuelve'));
    assert.ok(matches('Fútbol: resultados de la fecha'));
    assert.ok(buildKeywordMatcher(['futbol'])('Así se vive el fútbol'));
  });

  it('matches whole words only', () => {
    const matches = buildKeywordMatcher(['river', 'gol']);
    assert.ok(matches('River ganó el clásico'));
    assert.ok(matches('Un gol en el último minuto'));
    assert.equal(matches('Riverside news'), null);
    assert.equal(matches('El golpe de calor'), null);
    assert.equal(matches('Golf: el torneo'), null);
  });

  it('matches multi-word phrases', () => {
    const matches = buildKeywordMatcher(['Copa América']);
    assert.ok(matches('Arranca la copa  america 2027'));
    assert.equal(matches('La copa del mundo en América'), null);
  });

  it('treats regex characters in keywords literally', () => {
    const matches = buildKeywordMatcher(['c++', '(beta)']);
    assert.ok(matches('Aprender C++ hoy'));
    assert.ok(matches('Nueva app (beta) disponible'));
    assert.equal(matches('Aprender C hoy'), null);
  });

  it('returns the matching keyword as the user wrote it', () => {
    const matches = buildKeywordMatcher(['  Fútbol ', 'Messi']);
    assert.equal(matches('El futbol argentino'), 'Fútbol');
    assert.equal(matches('MESSI renovó'), 'Messi');
  });

  it('reports the longest keyword when keywords overlap', () => {
    const matches = buildKeywordMatcher(['Copa', 'Copa América']);
    assert.equal(matches('Arranca la Copa América'), 'Copa América');
    assert.equal(matches('Arranca la Copa del Rey'), 'Copa');
  });

  it('matches any keyword in the list', () => {
    const matches = buildKeywordMatcher(['Messi', 'Boca']);
    assert.ok(matches('Messi renovó'));
    assert.ok(matches('Boca juega el domingo'));
    assert.equal(matches('La economía creció'), null);
  });
});

describe('case-sensitive keywords (in double quotes)', () => {
  it('match only with the same capital letters', () => {
    const matches = buildKeywordMatcher(['"Máxima"']);
    assert.equal(matches('El look de Máxima en La Haya'), '"Máxima"');
    assert.equal(matches('Temperatura máxima de 35 grados'), null);
    assert.equal(matches('Cárcel de MÁXIMA seguridad'), null);
  });

  it('still ignore accents and whole-word rules apply', () => {
    const matches = buildKeywordMatcher(['"Máxima"']);
    assert.equal(matches('Maxima visitó Buenos Aires'), '"Máxima"');
    assert.equal(matches('Maximiliano ganó'), null);
  });

  it('accept curly quotes and phrases', () => {
    const matches = buildKeywordMatcher(['“Casa Rosada”']);
    assert.equal(matches('Reunión en la Casa Rosada'), '“Casa Rosada”');
    assert.equal(matches('Una casa rosada en venta'), null);
  });

  it('work together with ordinary keywords, reporting the earliest match', () => {
    const matches = buildKeywordMatcher(['"Máxima"', 'reina']);
    assert.equal(matches('La reina Máxima en Madrid'), 'reina');
    assert.equal(matches('Máxima y la reina Letizia'), '"Máxima"');
    assert.equal(matches('Ola de calor: máxima de 38'), null);
  });

  it('ignore empty quotes', () => {
    assert.equal(buildKeywordMatcher(['""', '“ ”']), null);
  });
});

describe('hostMatchesSite', () => {
  it('matches the site and its subdomains', () => {
    assert.ok(hostMatchesSite('example.com', ['example.com']));
    assert.ok(hostMatchesSite('www.example.com', ['example.com']));
    assert.ok(hostMatchesSite('WWW.EXAMPLE.COM', ['example.com']));
  });

  it('does not match other sites that merely end the same way', () => {
    assert.equal(hostMatchesSite('notexample.com', ['example.com']), false);
    assert.equal(hostMatchesSite('example.com.evil.net', ['example.com']), false);
  });

  it('tolerates invalid stored values', () => {
    assert.equal(hostMatchesSite('example.com', undefined), false);
    assert.equal(hostMatchesSite('example.com', [null, 3]), false);
  });
});

describe('filter.js', () => {
  it('uses the same message names as extension/shared/messages.js', async () => {
    const { MessageType } = await import('../extension/shared/messages.js');
    const script = readFileSync(new URL('../extension/content/filter.js', import.meta.url), 'utf8');
    for (const [name, value] of Object.entries(MessageType)) {
      assert.match(script, new RegExp(`${name} = '${value}'`), name);
    }
  });
});
