import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCommand } from '../src/check.js';
import { loadPolicy } from '../src/policy.js';

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-policy-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const config = join(dir, 'policy.json');
  writeFileSync(join(dir, 'example'), 'PORT=\nOPTIONAL=');
  writeFileSync(join(dir, 'env'), 'PORT=3000\nEXTRA=ok');
  return { config, run: (...args) => checkCommand(['--example', join(dir, 'example'), '--env', join(dir, 'env'), '--config', config, '--format', 'json', ...args]) };
}

test('policy files configure checks and explicit CLI rules replace file rules', t => {
  const { config, run } = fixture(t);
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, optional: ['OPTIONAL'], types: { PORT: 'port' }, extras: 'error', references: 'check' }));
  assert.deepEqual(JSON.parse(run().output).findings.map(f => f.code), ['unexpected']);
  assert.equal(run('--extras', 'allow').exitCode, 0);
  assert.deepEqual(JSON.parse(run('--optional', 'PORT', '--extras', 'allow').output).findings.map(f => f.code), ['missing']);
});

test('invalid policy files fail safely, including unknown fields and bad encoding', t => {
  const { config, run } = fixture(t);
  for (const policy of [null, [], {}, { schemaVersion: 2 }, { schemaVersion: 1, secret: 'private-secret' }, { schemaVersion: 1, optional: ['A', 'A'] }, { schemaVersion: 1, optional: [2] }, { schemaVersion: 1, types: { A: 'int' } }, { schemaVersion: 1, types: [] }, { schemaVersion: 1, references: true }, { schemaVersion: 1, extras: 'oops' }]) {
    writeFileSync(config, JSON.stringify(policy));
    assert.throws(run, error => error.exitCode === 2 && !error.message.includes('private-secret'));
  }
  for (const content of ['private-secret{', Buffer.from([0xff])]) {
    writeFileSync(config, content);
    assert.throws(run, error => error.exitCode === 2 && !error.message.includes('private-secret'));
  }
  assert.throws(() => loadPolicy(join(config, 'absent')), error => error.exitCode === 2);
});

test('empty lists and UTF-8 BOM are supported; configured key typos remain errors', t => {
  const { config, run } = fixture(t);
  writeFileSync(config, '\uFEFF' + JSON.stringify({ schemaVersion: 1, optional: [], types: {} }));
  assert.equal(loadPolicy(config).get('--optional'), '');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, optional: ['TYPO'] }));
  assert.throws(run, error => error.exitCode === 2);
});

test('CLI can explicitly clear optional and type rules loaded from a policy', t => {
  const { config, run } = fixture(t);
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, optional: ['OPTIONAL'], types: { PORT: 'boolean' } }));
  assert.deepEqual(JSON.parse(run().output).findings.map(f => f.code), ['type']);
  assert.equal(run('--types', '-').exitCode, 0);
  const cleared = JSON.parse(run('--optional', '-', '--types', '-').output);
  assert.deepEqual(cleared.findings.map(f => f.code), ['missing']);
  assert.equal(cleared.required, 2);
  for (const args of [['--types', '-,PORT:port'], ['--optional', '-,OPTIONAL'], ['--types', '-', '--types', 'PORT:port']]) {
    assert.throws(() => run(...args), error => error.exitCode === 2);
  }
  assert.equal(checkCommand(['--types', '-', '--optional', '-', '--example', join(config, '..', 'example'), '--env', join(config, '..', 'env')]).exitCode, 1);
});
