import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCommand } from '../src/check.js';

function checker(t, example, env) {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-options-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const examplePath = join(dir, 'example');
  const envPath = join(dir, 'actual');
  writeFileSync(examplePath, example);
  writeFileSync(envPath, env);
  return (...options) => checkCommand(['--example', examplePath, '--env', envPath, '--format', 'json', ...options]);
}

test('optional keys may be absent, but present empty or duplicate keys still fail', t => {
  const absent = checker(t, 'A=\nB=\n', 'A=ready');
  assert.equal(absent().exitCode, 1);
  const result = absent('--optional', 'B');
  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.output).required, 1);
  const present = checker(t, 'A=\nB=\n', 'A=ready\nB=first-secret\nB=');
  assert.deepEqual(JSON.parse(present('--optional', 'B').output).findings.map(f => f.code), ['duplicate', 'empty']);
});

test('optional lists reject typos, duplicate names, malformed lists, and repeated options', t => {
  const run = checker(t, 'A=\nB=\n', 'A=ready');
  for (const list of ['TYPO', 'A,A', 'A,', ',A', 'A, B', 'BAD-NAME']) {
    assert.throws(() => run('--optional', list), error => error.exitCode === 2);
  }
  assert.throws(() => run('--optional', 'A', '--optional', 'B'), error => error.exitCode === 2);
  assert.equal(run('--optional', 'A,B').exitCode, 0);
});
