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

test('boolean and port rules validate actual values without leaking them', t => {
  for (const port of ['1', '65535']) {
    assert.equal(checker(t, 'PORT=\nDEBUG=\n', `PORT=${port}\nDEBUG=false`)('--types', 'PORT:port,DEBUG:boolean').exitCode, 0);
  }
  for (const port of ['0', '65536', '-1', '1.5', '1e2', '080', 'private-value']) {
    const result = checker(t, 'PORT=\n', `PORT=${port}`)('--types', 'PORT:port');
    assert.equal(result.exitCode, 1);
    assert.deepEqual(JSON.parse(result.output).findings, [{ code: 'type', role: 'env', key: 'PORT', line: 1, expected: 'port' }]);
  }
  for (const value of ['TRUE', 'yes', '1', 'false-secret']) {
    assert.equal(checker(t, 'DEBUG=\n', `DEBUG=${value}`)('--types', 'DEBUG:boolean').exitCode, 1);
  }
});

test('type rules compose with optional settings and reject invalid policies', t => {
  const run = checker(t, 'PORT=\n', '');
  assert.equal(run('--optional', 'PORT', '--types', 'PORT:port').exitCode, 0);
  for (const rules of ['PORT:integer', 'PORT', 'PORT:port,PORT:boolean', 'TYPO:port', 'PORT:port,']) {
    assert.throws(() => run('--types', rules), error => error.exitCode === 2);
  }
  const empty = checker(t, 'PORT=\n', 'PORT=')('--types', 'PORT:port');
  assert.deepEqual(JSON.parse(empty.output).findings.map(f => f.code), ['empty']);
});

test('optional keys may be absent, but present empty or duplicate keys still fail', t => {
  const absent = checker(t, 'A=\nB=\n', 'A=ready');
  assert.equal(absent().exitCode, 1);
  const result = absent('--optional', 'B');
  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.output).required, 1);
  const present = checker(t, 'A=\nB=\n', 'A=ready\nB=first-secret\nB=');
  assert.deepEqual(JSON.parse(present('--optional', 'B').output).findings.map(f => f.code), ['duplicate', 'empty']);
});

test('reference checks detect missing and empty targets without leaking value fragments', t => {
  const run = checker(t, 'URL=\n', 'URL=secret-prefix-${MISSING_SECRET_NAME}\n');
  assert.equal(run().exitCode, 0);
  const result = run('--references', 'check');
  assert.equal(result.exitCode, 1);
  assert.deepEqual(JSON.parse(result.output).findings, [{ code: 'unresolved', role: 'env', key: 'URL', line: 1 }]);
  assert.doesNotMatch(result.output, /secret-prefix|MISSING_SECRET_NAME/);
  assert.equal(checker(t, 'URL=\n', 'URL=${HOST}\nHOST=')('--references', 'check').exitCode, 1);
  assert.equal(checker(t, 'URL=\n', 'URL=${HOST}\nHOST=localhost')('--references', 'check').exitCode, 0);
  assert.throws(() => run('--references', 'expand'), error => error.exitCode === 2);
});

test('reference checks ignore comments, escaped references, and single quoted literal values', t => {
  for (const value of ["'${MISSING}'", 'literal # ${MISSING}', '\\${MISSING}', '"\\${MISSING}"']) {
    assert.equal(checker(t, 'URL=\n', `URL=${value}`)('--references', 'check').exitCode, 0);
  }
  assert.equal(checker(t, 'URL=\n', 'URL="${MISSING}"')('--references', 'check').exitCode, 1);
});

test('optional lists reject typos, duplicate names, malformed lists, and repeated options', t => {
  const run = checker(t, 'A=\nB=\n', 'A=ready');
  for (const list of ['TYPO', 'A,A', 'A,', ',A', 'A, B', 'BAD-NAME']) {
    assert.throws(() => run('--optional', list), error => error.exitCode === 2);
  }
  assert.throws(() => run('--optional', 'A', '--optional', 'B'), error => error.exitCode === 2);
  assert.equal(run('--optional', 'A,B').exitCode, 0);
});
