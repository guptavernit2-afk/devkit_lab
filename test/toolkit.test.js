import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsonCommand } from '../src/json.js';
import { urlCommand } from '../src/url.js';
import { timeCommand } from '../src/time.js';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
const invoke = (args, input) => spawnSync(process.execPath, [cli, ...args], {
  encoding: 'utf8', input,
});

test('JSON formatting preserves nested data and handles primitive values', () => {
  const value = { title: 'hello', nested: [1, null, true] };
  assert.equal(jsonCommand(['format', JSON.stringify(value)]), JSON.stringify(value, null, 2));
  for (const input of ['null', 'false', '0', '""', '[]']) {
    assert.equal(jsonCommand(['validate', input]), 'Valid JSON');
  }
});

test('JSON rejects malformed data and incorrect arguments', () => {
  for (const input of ['', '{', '{"x":1,}', 'undefined']) {
    assert.throws(() => jsonCommand(['validate', input]), /Invalid JSON/);
  }
  assert.throws(() => jsonCommand(['format']), /Usage/);
  assert.throws(() => jsonCommand(['format', '{}', 'extra']), /Usage/);
});

test('JSON minification removes whitespace without changing nested values or string contents', () => {
  const value = { text: ' keep  spaces\n\t"quotes" ', unicode: 'नमस्ते 🌍',
    nested: [null, true, false, 0, { empty: '' }] };
  const result = jsonCommand(['minify', JSON.stringify(value, null, 2)]);
  assert.equal(result, JSON.stringify(value));
  assert.deepEqual(JSON.parse(result), value);
  for (const input of ['null', 'true', '0', '""', '[]', '{}']) {
    assert.equal(jsonCommand(['minify', `  ${input}  `]), input);
  }
});

test('JSON minification supports files and stdin through the CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-minify-'));
  try {
    const path = join(dir, 'data with spaces.json');
    const input = '{\n  "ok": true,\n  "text": "a  b"\n}';
    writeFileSync(path, input);
    for (const result of [invoke(['json', 'minify', '--file', path]),
      invoke(['json', 'minify', '--stdin'], input)]) {
      assert.equal(result.status, 0);
      assert.equal(result.stdout, '{"ok":true,"text":"a  b"}\n');
      assert.equal(result.stderr, '');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON minification rejects invalid input and incorrect arguments', () => {
  for (const input of ['', '{', '{"x":1,}']) {
    const result = invoke(['json', 'minify', '--stdin'], input);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error: Invalid JSON:/);
  }
  for (const args of [[], ['{}', 'extra'], ['--file'], ['--unknown']]) {
    assert.throws(() => jsonCommand(['minify', ...args]), /Usage/);
  }
  assert.match(jsonCommand(['--help']), /format\|minify\|validate/);
});

test('JSON accepts file and piped input, and reports missing files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-test-'));
  try {
    const path = join(dir, 'data with spaces.json');
    writeFileSync(path, '{"ok":true}');
    assert.equal(jsonCommand(['validate', '--file', path]), 'Valid JSON');
    const result = invoke(['json', 'format', '--stdin'], '{"ok":true}');
    assert.equal(result.status, 0);
    assert.deepEqual(JSON.parse(result.stdout), { ok: true });
    assert.throws(() => jsonCommand(['validate', '--file', join(dir, 'missing.json')]), /ENOENT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('URL components round-trip Unicode, reserved characters, and empty text', () => {
  for (const input of ['hello world & friends', 'नमस्ते 🌍', 'a+b/c?d=e#f', '']) {
    assert.equal(urlCommand(['decode', urlCommand(['encode', input])]), input);
  }
  assert.equal(urlCommand(['encode', 'a b']), 'a%20b');
  assert.equal(urlCommand(['decode', 'a+b']), 'a+b');
});

test('URL conversion rejects malformed escapes and invalid Unicode', () => {
  for (const input of ['%', '%GG', '%E0%A4']) {
    assert.throws(() => urlCommand(['decode', input]), /Cannot decode/);
  }
  assert.throws(() => urlCommand(['encode', '\uD800']), /Cannot encode/);
  assert.throws(() => urlCommand(['encode']), /Usage/);
});

test('timestamps support seconds, milliseconds, and pre-epoch dates', () => {
  assert.equal(timeCommand(['from-unix', '0']), '1970-01-01T00:00:00.000Z');
  assert.equal(timeCommand(['from-unix', '-1']), '1969-12-31T23:59:59.000Z');
  assert.equal(timeCommand(['from-unix', '1234', '--ms']), '1970-01-01T00:00:01.234Z');
  assert.equal(timeCommand(['to-unix', '1970-01-01T00:00:01.234Z', '--ms']), '1234');
  assert.equal(timeCommand(['to-unix', '1969-12-31T23:59:59.999Z']), '-1');
  assert.equal(timeCommand(['to-unix', '1970-01-01T00:00:00.1Z', '--ms']), '100');
  assert.equal(timeCommand(['to-unix', '2024-02-29T00:00:00Z']), '1709164800');
});

test('timestamps reject impossible dates, ambiguous dates, and invalid units', () => {
  for (const value of ['2023-02-29T00:00:00Z', '2024-04-31T00:00:00Z',
    '2024-01-01T24:00:00Z', '2024-13-01T00:00:00Z', '2024-01-01',
    '2024-01-01T00:00:00+05:30', '2024-01-01T00:00:00.1234Z']) {
    assert.throws(() => timeCommand(['to-unix', value]));
  }
  for (const value of ['1.5', '1e3', 'NaN', '', '9007199254740992', '8640000000001']) {
    assert.throws(() => timeCommand(['from-unix', value]));
  }
  assert.throws(() => timeCommand(['from-unix', '0', '--seconds']), /Usage/);
  assert.throws(() => timeCommand(['from-unix', '0', '--ms', 'extra']), /Usage/);
});

test('CLI help exposes all tools and command-specific usage', () => {
  const result = invoke(['--help']);
  assert.equal(result.status, 0);
  for (const command of ['json', 'url', 'time']) {
    assert.ok(result.stdout.includes(command));
    const help = invoke([command, '--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage/);
  }
  assert.equal(invoke([]).status, 0);
});

test('CLI failures use stderr, exit nonzero, and produce no success output', () => {
  for (const args of [['unknown'], ['json', 'validate', '{'], ['url', 'decode', '%'],
    ['time', 'from-unix', 'nope']]) {
    const result = invoke(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /^Error:/);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  }
});
