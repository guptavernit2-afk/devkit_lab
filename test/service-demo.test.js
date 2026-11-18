import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

test('service onboarding works outside the repository cwd with file and piped inputs', () => {
  const script = fileURLToPath(new URL('../scripts/verify-service-demo.js', import.meta.url));
  const result = spawnSync(process.execPath, [script], { cwd: tmpdir(), encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /six mistakes caught/);
});
