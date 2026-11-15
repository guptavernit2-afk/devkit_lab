import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
function fixture(t, example, env) {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-json-report-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, '.env.example'), example);
  writeFileSync(join(dir, '.env'), env);
  return (args = ['--format', 'json']) => spawnSync(process.execPath, [cli, 'check', ...args], { cwd: dir, encoding: 'utf8' });
}

test('JSON success output is a single parseable versioned report without settings values', t => {
  const invoke = fixture(t, 'TOKEN=\nPORT=\n', 'TOKEN=private-value\nPORT=12345\n');
  const result = invoke();
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), { schemaVersion: 1, status: 'pass', required: 2, issueCount: 0, findings: [] });
  assert.doesNotMatch(result.stdout, /private-value|12345/);
});

test('JSON findings retain codes and line numbers and match the text report exit status', t => {
  const invoke = fixture(t, 'TOKEN=\nTOKEN=\nPORT=\nMISSING=\n', 'TOKEN=private-one\nTOKEN=private-two\nPORT=" "\ninvalid-private-text\n');
  const result = invoke();
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report, { schemaVersion: 1, status: 'fail', required: 3, issueCount: 5, findings: [
    { code: 'duplicate', role: 'example', key: 'TOKEN', lines: [1, 2] },
    { code: 'invalid', role: 'env', line: 4 },
    { code: 'duplicate', role: 'env', key: 'TOKEN', lines: [1, 2] },
    { code: 'missing', role: 'env', key: 'MISSING' },
    { code: 'empty', role: 'env', key: 'PORT', line: 3 },
  ] });
  assert.doesNotMatch(result.stdout + result.stderr, /private-one|private-two|invalid-private-text/);
  const text = invoke([]);
  assert.equal(text.status, result.status);
  assert.match(text.stdout, /5 issue\(s\) found/);
  assert.equal(invoke(['--format', 'text']).stdout, text.stdout);
});

test('empty examples have a structured no-requirements finding', t => {
  const result = fixture(t, '# empty\n', 'TOKEN=private-value\n')();
  assert.equal(result.status, 1);
  assert.deepEqual(JSON.parse(result.stdout).findings, [{ code: 'no-requirements', role: 'example' }]);
});

test('invalid formats and missing files use exit 2 with empty stdout and safe stderr', t => {
  const invoke = fixture(t, 'TOKEN=\n', 'TOKEN=private-value\n');
  for (const args of [['--format', 'xml'], ['--format'], ['--format', 'json', '--format', 'text'],
    ['--format', 'json', '--env', 'missing-file']]) {
    const result = invoke(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error:/);
    assert.doesNotMatch(result.stderr, /private-value/);
  }
});
