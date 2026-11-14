import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsonCommand } from '../src/json.js';

test('JSON accepts one leading BOM across formatting, minification, and validation', () => {
  for (const action of ['format', 'minify', 'validate']) {
    for (const source of ['{}', 'null', 'false', '42', '"नमस्ते"', '\n {"ok":true}']) {
      assert.equal(jsonCommand([action, `\uFEFF${source}`]), jsonCommand([action, source]));
    }
  }
});

test('JSON accepts BOM-prefixed UTF-8 files and piped bytes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-bom-'));
  try {
    const path = join(dir, 'editor output.json');
    const bytes = Buffer.from('\uFEFF{ "ok": true }', 'utf8');
    writeFileSync(path, bytes);
    for (const action of ['format', 'minify', 'validate']) {
      for (const input of [['--file', path], ['--stdin']]) {
        const result = spawnSync(process.execPath, ['bin/devkit.js', 'json', action, ...input], { input: bytes, encoding: 'utf8' });
        assert.equal(result.status, 0);
        assert.equal(result.stderr, '');
        if (action === 'validate') assert.equal(result.stdout, 'Valid JSON\n');
        else assert.deepEqual(JSON.parse(result.stdout), { ok: true });
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('JSON preserves BOM characters in strings and still rejects malformed JSON', () => {
  const source = JSON.stringify({ value: '\uFEFFinside\uFEFF' });
  assert.deepEqual(JSON.parse(jsonCommand(['format', `\uFEFF${source}`])), { value: '\uFEFFinside\uFEFF' });
  for (const source of ['\uFEFF', '\uFEFF{', '\uFEFF\uFEFF{}', ' \uFEFF{}', '{}\uFEFF']) {
    for (const action of ['format', 'minify', 'validate']) {
      assert.throws(() => jsonCommand([action, source]), /Invalid JSON/);
    }
  }
});
