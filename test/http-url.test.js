import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

const policy = { types: new Map([['API_URL', 'http-url']]) };
test('HTTP URL rules accept absolute endpoints and reject repaired or unsafe forms', () => {
  for (const value of ['https://example.test/api?x=1', 'HTTP://localhost:3000', 'http://[::1]:8080/path', 'https://example.test/a%20b']) {
    assert.equal(inspectSettings('API_URL=', `API_URL="${value}"`, policy).findings.length, 0, value);
  }
  for (const value of ['example.test', '//example.test', 'ftp://example.test', 'http:///example.test', 'https://', 'https://example.test:99999', 'https://user:private@example.test', 'https://@example.test', 'https://example.test/a b', ' https://example.test', 'https://example.test/${TOKEN}', 'https://example.test\\path']) {
    const report = inspectSettings('API_URL=', `API_URL='${value}'`, policy);
    assert.deepEqual(report.findings, [{ code: 'type', role: 'env', key: 'API_URL', line: 1, expected: 'http-url' }], value);
    assert.doesNotMatch(JSON.stringify(report), /private|example.test|TOKEN/);
  }
  assert.deepEqual(inspectSettings('API_URL=', 'API_URL=', policy).findings.map(f => f.code), ['empty']);
  assert.equal(inspectSettings('API_URL=', '', { ...policy, optional: ['API_URL'] }).findings.length, 0);
});

test('HTTP URL types work through CLI and policy files', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-http-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'API_URL=');
  writeFileSync(env, 'API_URL=https://example.test');
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, types: { API_URL: 'http-url' } }));
  const args = ['--example', example, '--env', env];
  assert.equal(checkCommand([...args, '--types', 'API_URL:http-url']).exitCode, 0);
  assert.equal(checkCommand([...args, '--config', config]).exitCode, 0);
});
