import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { base64Command } from '../src/base64.js';

test('Base64 supports known vectors, Unicode, empty text, and BOM characters', () => {
  assert.equal(base64Command(['encode', 'hello']), 'aGVsbG8=');
  assert.equal(base64Command(['decode', 'aGVsbG8=']), 'hello');
  for (const value of ['', 'नमस्ते 🌍', 'a\n\tb', '\uFEFFhello', '\0']) {
    assert.equal(base64Command(['decode', base64Command(['encode', value])]), value);
  }
});

test('Base64 rejects invalid alphabet, padding, pad bits, and non-UTF-8 bytes', () => {
  for (const value of ['aGVsbG8', 'aGVsbG8=\n', '!!!!', 'Zg===', 'Zh==', '_w==']) {
    assert.throws(() => base64Command(['decode', value]), /canonical/);
  }
  assert.throws(() => base64Command(['decode', '/w==']), /UTF-8/);
  assert.throws(() => base64Command(['encode', '\uD800']), /Unicode/);
  assert.throws(() => base64Command(['encode']), /Usage/);
  assert.throws(() => base64Command(['decode', 'Zg==', 'extra']), /Usage/);
});

test('Base64 CLI preserves piped whitespace and returns readable errors', () => {
  const invoke = (args, input) => spawnSync(process.execPath, ['bin/devkit.js', 'base64', ...args], { input, encoding: 'utf8' });
  const encoded = invoke(['encode', '--stdin'], 'hello\n');
  assert.equal(encoded.status, 0);
  assert.equal(encoded.stdout, 'aGVsbG8K\n');
  const decoded = invoke(['decode', '--stdin'], 'aGVsbG8K');
  assert.equal(decoded.status, 0);
  assert.equal(decoded.stdout, 'hello\n\n');
  const invalid = invoke(['decode', '/w==']);
  assert.equal(invalid.status, 1);
  assert.equal(invalid.stdout, '');
  assert.match(invalid.stderr, /UTF-8/);
  const invalidInput = invoke(['encode', '--stdin'], Buffer.from([0xff]));
  assert.equal(invalidInput.status, 1);
  assert.match(invalidInput.stderr, /UTF-8/);
  assert.match(invoke(['--help']).stdout, /Usage/);
});
