import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesType } from '../src/types.js';
import { inspectSettings } from '../src/check.js';

test('HTTP endpoint validation rejects literal ASCII controls before URL normalization', () => {
  for (const code of [...Array.from({ length: 32 }, (_, i) => i), 127]) {
    const control = String.fromCharCode(code);
    for (const value of [`https://example.test/a${control}b`, `https://example.test/path${control}`, `https://example.test/?q=${control}`]) {
      assert.equal(matchesType(value, 'http-url'), false, `control ${code}`);
    }
  }
  for (const value of ['https://example.test/a%20b', 'https://example.test/%00', 'https://example.test/café']) {
    assert.equal(matchesType(value, 'http-url'), true);
  }
});

test('control-bearing settings produce value-free type findings', () => {
  const report = inspectSettings('API_URL=', 'API_URL="https://example.test/private' + String.fromCharCode(0) + '"', {
    types: new Map([['API_URL', 'http-url']]),
  });
  assert.deepEqual(report.findings, [{ code: 'type', role: 'env', key: 'API_URL', line: 1, expected: 'http-url' }]);
  assert.doesNotMatch(JSON.stringify(report), /example.test|private/);
});
