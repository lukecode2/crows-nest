import { test } from 'node:test';
import assert from 'node:assert/strict';
import { h } from '../../js/ui.js';
test('ARIA boolean values are strings; native disabled stays boolean', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } }) };
  try {
    assert.equal(h('button', { 'aria-pressed': true }).attrs['aria-pressed'], 'true');
    assert.equal(h('button', { 'aria-pressed': false }).attrs['aria-pressed'], 'false');
    assert.equal(h('button', { disabled: true }).disabled, true);
    assert.equal(h('button', { disabled: false }).attrs.disabled, undefined);
  } finally { globalThis.document = previous; }
});
