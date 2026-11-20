import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectSettings, checkCommand } from '../src/check.js';

const rules = { types: new Map([['OPTIONS', 'json']]) };
test('JSON settings accept JSON values and multiline objects without expanding strings', () => {
  for (const value of ['{}', '[1,true,null]', '"hello"', '42', 'false', 'null', '{\n"feature":true,\n"path":"C:\\\\dummy"\n}', '{"literal":"${UNDEFINED}"}']) {
    assert.equal(inspectSettings('OPTIONS=', `OPTIONS='${value}'`, { ...rules, references: true }).findings.length, 0, value);
  }
  for (const value of ['{bad}', '{"secret":"private",}', '[1,]', 'undefined', 'NaN', '{} {}']) {
    assert.deepEqual(inspectSettings('OPTIONS=', `OPTIONS='${value}'`, rules).findings, [{ code: 'type', role: 'env', key: 'OPTIONS', line: 1, expected: 'json' }]);
  }
  assert.equal(inspectSettings('OPTIONS=', '', { ...rules, optional: ['OPTIONS'] }).findings.length, 0);
  assert.deepEqual(inspectSettings('OPTIONS=', 'OPTIONS=', rules).findings.map(f => f.code), ['empty']);
});

test('CLI and file policies report JSON syntax failures without parser snippets', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-json-type-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const example = join(dir, 'example');
  const env = join(dir, 'actual');
  const config = join(dir, 'policy.json');
  writeFileSync(example, 'OPTIONS=');
  writeFileSync(env, "OPTIONS='private-json-error'");
  writeFileSync(config, JSON.stringify({ schemaVersion: 1, types: { OPTIONS: 'json' } }));
  for (const format of ['text', 'json']) {
    for (const extra of [['--types', 'OPTIONS:json'], ['--config', config]]) {
      const result = checkCommand(['--example', example, '--env', env, '--format', format, '--explain', 'on', ...extra]);
      assert.equal(result.exitCode, 1);
      assert.match(result.output, /single-quote/);
      assert.doesNotMatch(result.output, /private-json-error|Unexpected token/);
    }
  }
});
