import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { hashCommand } from '../src/hash.js';

test('SHA-256 matches known empty and ASCII test vectors', () => {
  assert.equal(hashCommand(['']), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(hashCommand(['abc']), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(hashCommand(['नमस्ते 🌍']), createHash('sha256').update('नमस्ते 🌍').digest('hex'));
});

test('SHA-256 handles binary files across chunk boundaries and raw piped bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-hash-'));
  try {
    const path = join(dir, 'binary data.bin');
    const bytes = Buffer.alloc(150001);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i % 256;
    writeFileSync(path, bytes);
    const expected = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hashCommand(['--file', path]), expected);
    const result = spawnSync(process.execPath, ['bin/devkit.js', 'hash', '--stdin'], { input: bytes, encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
    assert.equal(result.stderr, '');
    assert.throws(() => hashCommand(['--file', join(dir, 'missing')]), /ENOENT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('SHA-256 preserves newline differences and rejects invalid usage', () => {
  assert.notEqual(hashCommand(['abc']), hashCommand(['abc\n']));
  for (const args of [[], ['--file'], ['--stdin', 'extra'], ['--unknown'], ['a', 'b']]) {
    assert.throws(() => hashCommand(args), /Usage/);
  }
  assert.throws(() => hashCommand(['\uD800']), /Unicode/);
  assert.match(hashCommand(['--help']), /SHA-256/);
});
