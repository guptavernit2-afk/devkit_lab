import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-stdin-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, '.env.example'), 'A=');
  writeFileSync(join(dir, '.env'), 'A=ready');
  return (args, input) => spawnSync(process.execPath, [cli, 'check', '--format', 'json', ...args], { cwd: dir, input, encoding: 'utf8', timeout: 10000 });
}

test('piped actual and example inputs work without writing temporary settings', t => {
  const run = fixture(t);
  for (const [args, input] of [[['--env', '-'], 'A=private-value'], [['--example', '-'], '\uFEFFA=\r\n']]) {
    const result = run(args, input);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).status, 'pass');
    assert.doesNotMatch(result.stdout + result.stderr, /private-value/);
  }
  const missing = run(['--env', '-'], '');
  assert.equal(missing.status, 1);
  assert.equal(JSON.parse(missing.stdout).findings[0].code, 'missing');
});

test('ambiguous streams and malformed UTF-8 return input errors without leaking data', t => {
  const run = fixture(t);
  for (const [args, input] of [[['--example', '-', '--env', '-'], 'A=secret'], [['--env', '-'], Buffer.from([0xff])]]) {
    const result = run(args, input);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stdout, '');
    assert.doesNotMatch(result.stderr, /secret/);
  }
});
