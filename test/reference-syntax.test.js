import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSettings } from '../src/check.js';

test('unsupported reference expressions fail opt-in checks without leaking snippets', () => {
  for (const value of ['$SECRET', '${SECRET:-private}', '${SECRET', '${}', '$(private-command)']) {
    const report = inspectSettings('A=', `A=${value}`, { references: true });
    assert.deepEqual(report.findings, [{ code: 'unsupported-reference', role: 'env', key: 'A', line: 1 }]);
    assert.equal(inspectSettings('A=', `A=${value}`).findings.length, 0);
  }
});

test('literal dollars, comments and escaped or single-quoted expressions are accepted', () => {
  for (const value of ['$5', 'cost$', '\\$SECRET', "'${SECRET:-private}'", 'ok # $SECRET']) {
    assert.equal(inspectSettings('A=', `A=${value}`, { references: true }).findings.length, 0);
  }
  const report = inspectSettings('A=', 'A=${MISSING}-$OTHER', { references: true });
  assert.deepEqual(report.findings.map(f => f.code), ['unsupported-reference', 'unresolved']);
});
