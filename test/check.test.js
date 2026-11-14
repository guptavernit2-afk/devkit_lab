import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSettings, inspectSettings, checkCommand } from '../src/check.js';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
function fixture(t, example = 'API_KEY=\nPORT=\n', env = 'API_KEY=demo-secret\nPORT=3000\n') {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-check-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, '.env.example'), example);
  writeFileSync(join(dir, '.env'), env);
  const invoke = (args = [], options = {}) => spawnSync(process.execPath, [cli, 'check', ...args], {
    cwd: dir, encoding: 'utf8', ...options,
  });
  return { dir, invoke };
}

test('settings parser handles BOM, line endings, comments, export, quotes, and equals signs', () => {
  const source = '\uFEFF# comment\r\n export API_KEY = "a#b=c" # note\r\nPORT=0\rFLAG=false\nSINGLE=\'literal\\path\'\nDOUBLE="a\\\"b\\n"\nURL=https://example.test/?a=b#comment\n';
  const parsed = parseSettings(source);
  assert.deepEqual(parsed.invalidLines, []);
  assert.equal(parsed.settings.get('API_KEY').value, 'a#b=c');
  assert.equal(parsed.settings.get('PORT').value, '0');
  assert.equal(parsed.settings.get('FLAG').value, 'false');
  assert.equal(parsed.settings.get('SINGLE').value, 'literal\\path');
  assert.equal(parsed.settings.get('DOUBLE').value, 'a"b\n');
  assert.equal(parsed.settings.get('URL').value, 'https://example.test/?a=b');
});

test('checker reports missing, empty, and duplicate settings with source lines', () => {
  const report = inspectSettings('API_KEY=\nPORT=\nMISSING=\n', 'API_KEY=first\nAPI_KEY=second\nPORT=" "\nEXTRA=\n');
  assert.equal(report.required, 3);
  assert.deepEqual(report.findings, [
    { code: 'duplicate', role: 'env', key: 'API_KEY', lines: [1, 2] },
    { code: 'missing', role: 'env', key: 'MISSING' },
    { code: 'empty', role: 'env', key: 'PORT', line: 3 },
    { code: 'empty', role: 'env', key: 'EXTRA', line: 4 },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /first|second/);
});

test('empty declarations include quoted whitespace and comment-only values, but not zero or false', () => {
  const report = inspectSettings('A=\nB=\nC=\nD=\nE=\nF=\n', "A=\nB=''\nC=\"  \"\nD= # note\nE=0\nF=false");
  assert.deepEqual(report.findings.map(f => f.key), ['A', 'B', 'C', 'D']);
});

test('duplicates in either file fail even with identical values, including prototype-like names', () => {
  const report = inspectSettings('__proto__=\n__proto__=\n', '__proto__=x\n__proto__=x\n__proto__=\n');
  assert.deepEqual(report.findings, [
    { code: 'duplicate', role: 'example', key: '__proto__', lines: [1, 2] },
    { code: 'duplicate', role: 'env', key: '__proto__', lines: [1, 2, 3] },
    { code: 'empty', role: 'env', key: '__proto__', line: 3 },
  ]);
});

test('malformed declarations and unsupported multiline quotes are flagged without source contents', () => {
  const parsed = parseSettings('GOOD=yes\nBAD-NAME=secret\nNO_EQUALS_SECRET\nA="secret\nB="value"trailing-secret\n9KEY=secret\nBACKTICK=`secret`\n');
  assert.deepEqual(parsed.invalidLines, [2, 3, 4, 5, 6, 7]);
  const report = inspectSettings('A=\n', 'A="secret\n');
  assert.ok(report.findings.some(f => f.code === 'invalid'));
  assert.doesNotMatch(JSON.stringify(report), /secret/);
});

test('empty example files fail rather than falsely approving a project', () => {
  assert.ok(inspectSettings('# only a comment\n', 'A=yes').findings.some(f => f.code === 'no-requirements'));
  assert.ok(inspectSettings('A=\n', '').findings.some(f => f.code === 'missing'));
});

test('clean CLI check uses default paths and does not change files or expose values', t => {
  const { dir, invoke } = fixture(t);
  const before = readFileSync(join(dir, '.env'));
  const result = invoke();
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PASS: 2 required setting/);
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /demo-secret|3000/);
  assert.deepEqual(readFileSync(join(dir, '.env')), before);
});

test('CLI findings return exit 1, hide secrets, and ignore the shell environment', t => {
  const { invoke } = fixture(t, 'API_KEY=\nPORT=\nMISSING=\n', 'API_KEY=SUPER_SECRET_VALUE\nAPI_KEY=OTHER_SECRET_VALUE\nPORT=\ninvalid secret text\n');
  const result = invoke([], { env: { ...process.env, MISSING: 'supplied-by-shell' } });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, '');
  for (const expected of [/DUPLICATE env: API_KEY \(lines 1, 2\)/, /EMPTY env: PORT/, /MISSING env: MISSING/, /INVALID env: line 4/]) {
    assert.match(result.stdout, expected);
  }
  assert.doesNotMatch(result.stdout + result.stderr, /SUPER_SECRET_VALUE|OTHER_SECRET_VALUE|invalid secret text|supplied-by-shell/);
});

test('CLI supports explicit paths with spaces and flags duplicate example definitions', t => {
  const { dir, invoke } = fixture(t);
  writeFileSync(join(dir, 'example settings'), 'A=\nA=\n');
  writeFileSync(join(dir, 'actual settings'), 'A=ready');
  const result = invoke(['--env', 'actual settings', '--example', 'example settings']);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /DUPLICATE example: A \(lines 1, 2\)/);
  assert.doesNotMatch(result.stdout, /ready/);
});

test('CLI input failures use exit 2 and never expose file contents or stack traces', t => {
  const { dir, invoke } = fixture(t);
  writeFileSync(join(dir, 'binary'), Buffer.from([0xff]));
  for (const args of [['--env', 'missing-file'], ['--env', 'binary'], ['--example', 'missing-file'],
    ['--unknown'], ['--env'], ['--env', '.env', '--env', '.env'], ['--env', ''], ['extra']]) {
    const result = invoke(args);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error:/);
    assert.doesNotMatch(result.stderr, /demo-secret|\n\s+at /);
  }
});

test('check help succeeds without reading any files', () => {
  assert.match(checkCommand(['--help']), /Exit codes/);
  assert.match(checkCommand(['-h']), /Usage/);
});
