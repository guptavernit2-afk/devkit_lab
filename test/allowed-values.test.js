import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

const options = { allowed: new Map([['MODE', ['debug', 'info']]]) };
test('allowed values use exact comparisons and compose with optional, empty and duplicate checks', () => {
  assert.equal(inspectSettings('MODE=', 'MODE=info', options).findings.length, 0);
  for (const value of ['INFO', ' info ', '${OTHER}', 'private']) {
    assert.deepEqual(inspectSettings('MODE=', `MODE="${value}"`, options).findings, [{ code: 'allowed', role: 'env', key: 'MODE', line: 1 }]);
  }
  assert.equal(inspectSettings('MODE=', '', { ...options, optional: ['MODE'] }).findings.length, 0);
  assert.deepEqual(inspectSettings('MODE=', 'MODE=', options).findings.map(f => f.code), ['empty']);
  assert.deepEqual(inspectSettings('MODE=', 'MODE=debug\nMODE=wrong', options).findings.map(f => f.code), ['duplicate', 'allowed']);
  assert.throws(() => inspectSettings('OTHER=', 'OTHER=ok', options), error => error.exitCode === 2);
});

test('policy validation rejects malformed allowed lists and never exposes rule contents', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-allowed-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'MODE=');
  writeFileSync(env, 'MODE=private-actual');
  const run = (...args) => checkCommand(['--example', example, '--env', env, '--config', config, ...args]);
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, allowed: { MODE: ['private-allowed'] } }));
  for (const format of ['text', 'json']) {
    const result = run('--format', format);
    assert.equal(result.exitCode, 1);
    assert.doesNotMatch(result.output, /private-actual|private-allowed/);
  }
  for (const allowed of [[], null, { MODE: [] }, { MODE: 'private' }, { MODE: [''] }, { MODE: [' '] }, { MODE: [1] }, { MODE: ['private', 'private'] }, { TYPO: ['ok'] }, { 'BAD-KEY': ['ok'] }]) {
    writeFileSync(config, JSON.stringify({ schemaVersion: 1, allowed }));
    assert.throws(run, error => error.exitCode === 2 && !error.message.includes('private'));
  }
});
