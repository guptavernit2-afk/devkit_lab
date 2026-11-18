import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCommand } from '../src/check.js';
import { findingHint } from '../src/hints.js';

test('explanations add actionable hints without changing finding codes or exit status', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-explain-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  writeFileSync(example, 'PORT=\nMISSING=');
  writeFileSync(env, 'PORT=private-invalid-port');
  const run = (...args) => checkCommand(['--example', example, '--env', env, '--types', 'PORT:port', ...args]);
  const original = run('--format', 'json');
  const explained = run('--format', 'json', '--explain', 'on');
  const report = JSON.parse(explained.output);
  assert.equal(explained.exitCode, original.exitCode);
  assert.deepEqual(report.findings.map(({ hint, ...finding }) => finding), JSON.parse(original.output).findings);
  assert.match(report.findings[0].hint, /Add this key/);
  assert.match(report.findings[1].hint, /65535/);
  assert.equal(run('--format', 'json', '--explain', 'off').output, original.output);
  const text = run('--explain', 'on');
  assert.match(text.output, /Fix: Use a decimal integer/);
  assert.doesNotMatch(text.output + explained.output, /private-invalid-port/);
  assert.throws(() => run('--explain', 'yes'), error => error.exitCode === 2);
  writeFileSync(env, 'PORT=3000\nMISSING=ready');
  assert.deepEqual(JSON.parse(run('--format', 'json', '--explain', 'on').output).findings, []);
});

test('all checker finding categories have guidance independent of input values', () => {
  for (const code of ['invalid', 'duplicate', 'missing', 'empty', 'cycle', 'unsupported-reference', 'unresolved', 'unexpected', 'allowed', 'profile', 'no-requirements']) {
    const hint = findingHint({ code, key: 'private-key', value: 'private-value' });
    assert.equal(typeof hint, 'string');
    assert.ok(hint.length > 20);
    assert.doesNotMatch(hint, /private-key|private-value|Review the project policy and checker documentation/);
  }
  for (const expected of ['boolean', 'port', 'http-url']) assert.equal(typeof findingHint({ code: 'type', expected }), 'string');
});
