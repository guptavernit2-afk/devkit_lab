import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

test('impossible allowed/type combinations fail as policy errors even for absent optional settings', () => {
  for (const [type, choices] of [['boolean', ['yes', 'no']], ['port', ['0', '99999']], ['integer', ['1.5']], ['json', ['private-invalid']], ['http-url', ['private-relative']]]) {
    const options = { types: new Map([['A', type]]), allowed: new Map([['A', choices]]), optional: ['A'] };
    assert.throws(() => inspectSettings('A=', '', options), error => error.exitCode === 2 && /Conflicting policy/.test(error.message) && !/private/.test(error.message));
  }
});

test('overlapping rules allow valid choices and retain ordinary findings for invalid actual values', () => {
  const rules = { types: new Map([['A', 'boolean']]), allowed: new Map([['A', ['true', 'legacy']]]) };
  assert.equal(inspectSettings('A=', 'A=true', rules).findings.length, 0);
  assert.deepEqual(inspectSettings('A=', 'A=legacy', rules).findings.map(f => f.code), ['type']);
  assert.deepEqual(inspectSettings('A=', 'A=false', rules).findings.map(f => f.code), ['allowed']);
});

test('conflict detection uses effective CLI overrides rather than discarded config types', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-conflict-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'A=');
  writeFileSync(env, 'A=1');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, types: { A: 'boolean' }, allowed: { A: ['1'] } }));
  const args = ['--example', example, '--env', env, '--config', config];
  assert.throws(() => checkCommand(args), error => error.exitCode === 2);
  assert.equal(checkCommand([...args, '--types', 'A:integer']).exitCode, 0);
  assert.equal(checkCommand([...args, '--types', '-']).exitCode, 0);
});
