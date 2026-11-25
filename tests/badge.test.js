import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { badgeText } from '../extension/shared/badge.js';

describe('badgeText', () => {
  it('shows nothing when no article is hidden or the count is invalid', () => {
    for (const value of [0, -3, 1.5, NaN, undefined, null, 'x'])
      assert.equal(badgeText(value), '', String(value));
  });

  it('shows the count up to 99, then "99+"', () => {
    assert.equal(badgeText(1), '1');
    assert.equal(badgeText(99), '99');
    assert.equal(badgeText(100), '99+');
    assert.equal(badgeText(1234), '99+');
  });
});
