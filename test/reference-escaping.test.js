import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSettings, parseSettings } from '../src/check.js';

test('reference escaping uses source backslash parity before quoted value decoding', () => {
  for (let count = 0; count <= 6; count++) {
    for (const quoted of [false, true]) {
      const source = '\\'.repeat(count) + '${MISSING}';
      const env = `A=${quoted ? '"' + source + '"' : source}`;
      const findings = inspectSettings('A=', env, { references: true }).findings;
      assert.deepEqual(findings.map(f => f.code), count % 2 ? [] : ['unresolved'], `slashes=${count}, quoted=${quoted}`);
    }
  }
});

test('reference analysis excludes quoted comments and preserves literal decoded values', () => {
  const source = 'A="' + '\\'.repeat(2) + '${MISSING}" # ${IGNORED}';
  const entry = parseSettings(source).settings.get('A');
  assert.equal(entry.value, '\\${MISSING}');
  assert.deepEqual(entry.references, ['MISSING']);
  assert.deepEqual(parseSettings("A='${MISSING}'").settings.get('A').references, []);
  for (const count of [1, 2, 3, 4]) {
    const report = inspectSettings('A=', 'A="' + '\\'.repeat(count) + '$MISSING"', { references: true });
    assert.deepEqual(report.findings.map(f => f.code), count % 2 ? [] : ['unsupported-reference']);
  }
});
