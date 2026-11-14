import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { uuidCommand } from '../src/uuid.js';

const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('UUID generation defaults to one valid UUID v4', () => {
  assert.match(uuidCommand([]), uuidV4);
  assert.match(uuidCommand(['--count', '1']), uuidV4);
});

test('UUID batches honor count boundaries and generate distinct values', () => {
  for (const count of [2, 1000]) {
    const values = uuidCommand(['--count', String(count)]).split('\n');
    assert.equal(values.length, count);
    for (const value of values) assert.match(value, uuidV4);
    assert.equal(new Set(values).size, count);
  }
});

test('UUID counts reject oversized, fractional, ambiguous, and malformed inputs', () => {
  for (const count of ['0', '-1', '1.5', '1e2', '01', '+1', ' 2', '', '1001', '9007199254740992']) {
    assert.throws(() => uuidCommand(['--count', count]), /Count/);
  }
  for (const args of [['--count'], ['5'], ['--unknown', '2'], ['--count', '2', 'extra']]) {
    assert.throws(() => uuidCommand(args), /Usage/);
  }
});

test('UUID CLI emits one UUID per line and reports invalid input', () => {
  const invoke = args => spawnSync(process.execPath, ['bin/devkit.js', 'uuid', ...args], { encoding: 'utf8' });
  const result = invoke(['--count', '3']);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.ok(result.stdout.endsWith('\n'));
  const values = result.stdout.trimEnd().split('\n');
  assert.equal(values.length, 3);
  for (const value of values) assert.match(value, uuidV4);
  const invalid = invoke(['--count', '0']);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /Count/);
  assert.match(invoke(['--help']).stdout, /Usage/);
});
