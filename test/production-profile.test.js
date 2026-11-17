import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

const options = { profile: 'node-production' };
test('production profile is explicit and rejects development values without exposing them', () => {
  const source = 'NODE_ENV=private-development\nDEBUG=private-debug';
  assert.equal(inspectSettings('NODE_ENV=\nDEBUG=', source).findings.length, 0);
  const report = inspectSettings('NODE_ENV=\nDEBUG=', source, options);
  assert.deepEqual(report.findings.map(f => [f.code, f.key]), [['profile', 'NODE_ENV'], ['profile', 'DEBUG']]);
  assert.doesNotMatch(JSON.stringify(report), /private/);
  for (const env of ['NODE_ENV=production', 'NODE_ENV=production\nDEBUG=false']) {
    assert.equal(inspectSettings('NODE_ENV=', env, options).findings.length, 0);
  }
});

test('profile requirements cannot be disabled with optional keys or references', () => {
  assert.deepEqual(inspectSettings('NODE_ENV=', '', { ...options, optional: ['NODE_ENV'] }).findings, [{ code: 'profile', role: 'env', key: 'NODE_ENV', profile: 'node-production' }]);
  for (const value of ['Production', ' production ', '${MODE}']) {
    assert.equal(inspectSettings('NODE_ENV=', `NODE_ENV="${value}"\nMODE=production`, options).findings.some(f => f.code === 'profile'), true);
  }
  assert.throws(() => inspectSettings('A=', 'A=ok', { profile: 'unknown' }), error => error.exitCode === 2);
});

test('policy files enable profiles, CLI can disable them, and text output stays private', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-profile-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'NODE_ENV=\nDEBUG=');
  writeFileSync(env, 'NODE_ENV=private-mode\nDEBUG=true');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, profile: 'node-production' }));
  const args = ['--example', example, '--env', env, '--config', config];
  const result = checkCommand(args);
  assert.equal(result.exitCode, 1);
  assert.match(result.output, /PROFILE env: NODE_ENV/);
  assert.doesNotMatch(result.output, /private-mode/);
  assert.equal(checkCommand([...args, '--profile', 'none']).exitCode, 0);
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, profile: 'typo' }));
  assert.throws(() => checkCommand(args), error => error.exitCode === 2);
});
