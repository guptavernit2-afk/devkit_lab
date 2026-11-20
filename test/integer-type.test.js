import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

const policy = { types: new Map([['COUNT', 'integer']]) };
test('integer rules enforce decimal syntax and exact numeric bounds', () => {
  for (const value of ['0', '1', '-1', '9007199254740991', '-9007199254740991']) {
    assert.equal(inspectSettings('COUNT=', `COUNT=${value}`, policy).findings.length, 0);
  }
  for (const value of ['9007199254740992', '-9007199254740992', '1.5', '1e3', '+1', '-0', '01', '0xff', ' 1 ', 'NaN', 'private']) {
    assert.deepEqual(inspectSettings('COUNT=', `COUNT="${value}"`, policy).findings, [{ code: 'type', role: 'env', key: 'COUNT', line: 1, expected: 'integer' }]);
  }
  assert.equal(inspectSettings('COUNT=', '', { ...policy, optional: ['COUNT'] }).findings.length, 0);
  assert.deepEqual(inspectSettings('COUNT=', 'COUNT=', policy).findings.map(f => f.code), ['empty']);
});

test('integer rules work through CLI and policy files with useful safe hints', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-integer-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'COUNT=');
  writeFileSync(env, 'COUNT=private');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, types: { COUNT: 'integer' } }));
  const args = ['--example', example, '--env', env, '--explain', 'on'];
  for (const extra of [['--config', config], ['--types', 'COUNT:integer']]) {
    const result = checkCommand([...args, ...extra]);
    assert.equal(result.exitCode, 1);
    assert.match(result.output, /decimal integer/);
    assert.doesNotMatch(result.output, /private/);
  }
});
