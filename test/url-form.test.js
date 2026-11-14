import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { urlCommand } from '../src/url.js';

test('form values distinguish spaces, plus signs, and reserved punctuation', () => {
  assert.equal(urlCommand(['form-encode', "a b+c&d=!'()~*"]), 'a+b%2Bc%26d%3D%21%27%28%29%7E*');
  assert.equal(urlCommand(['form-decode', 'a+b%2Bc']), 'a b+c');
  for (const value of ['', 'नमस्ते 🌍', 'a\nb\tc', '% + / &=']) {
    assert.equal(urlCommand(['form-decode', urlCommand(['form-encode', value])]), value);
  }
  assert.equal(urlCommand(['decode', 'a+b']), 'a+b');
  assert.equal(urlCommand(['encode', 'a b']), 'a%20b');
});

test('form values reject invalid encoding and malformed arguments', () => {
  for (const value of ['%', '%GG', '%E0%A4']) {
    assert.throws(() => urlCommand(['form-decode', value]), /Cannot decode/);
  }
  assert.throws(() => urlCommand(['form-encode', '\uD800']), /Cannot encode/);
  assert.throws(() => urlCommand(['form-encode']), /Usage/);
  assert.throws(() => urlCommand(['form-decode', 'a', 'extra']), /Usage/);
});

test('form conversion is available from the CLI', () => {
  const result = spawnSync(process.execPath, ['bin/devkit.js', 'url', 'form-decode', 'a+b%2Bc'], { encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, 'a b+c\n');
  assert.equal(result.stderr, '');
});
