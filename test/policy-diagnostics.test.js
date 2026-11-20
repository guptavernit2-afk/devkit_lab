import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPolicy } from '../src/policy.js';

test('policy errors identify the failing stage without echoing paths or contents', t => {
  const dir = mkdtempSync(join(tmpdir(), 'devkit-diagnostics-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'private-file');
  const check = pattern => assert.throws(() => loadPolicy(path), error => error.exitCode === 2 && pattern.test(error.message) && !/private-file|secret-content/.test(error.message));
  check(/Cannot read/);
  writeFileSync(path, Buffer.from([0xff]));
  check(/UTF-8/);
  writeFileSync(path, '{"secret-content":');
  check(/valid JSON/);
  writeFileSync(path, '{"schemaVersion":1,"secret-content":true}');
  check(/schema is invalid/);
});
