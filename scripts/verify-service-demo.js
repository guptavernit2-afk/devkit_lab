import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
const fixture = name => fileURLToPath(new URL(`../examples/service/${name}`, import.meta.url));
const files = ['.env.example', 'policy.json', 'broken.env', 'ready.env'];
const before = new Map(files.map(name => [name, readFileSync(fixture(name))]));
function check(name, piped = false) {
  const result = spawnSync(process.execPath, [cli, 'check', '--example', fixture('.env.example'),
    '--env', piped ? '-' : fixture(name), '--config', fixture('policy.json'), '--format', 'json', '--explain', 'on'],
  { encoding: 'utf8', timeout: 10000, input: piped ? before.get(name) : undefined });
  assert.equal(result.error, undefined, 'Checker process must complete');
  assert.equal(result.stderr, '');
  assert.doesNotMatch(result.stdout, /dummy-endpoint|verbosee|MISSING_DUMMY_TARGET|onboarding example/);
  return { status: result.status, report: JSON.parse(result.stdout) };
}

const broken = check('broken.env');
assert.equal(broken.status, 1);
assert.equal(broken.report.issueCount, 6);
assert.deepEqual(broken.report.findings.map(({ code, key }) => [code, key]), [
  ['type', 'PORT'], ['type', 'API_URL'], ['allowed', 'LOG_LEVEL'],
  ['unresolved', 'WORKER_NAME'], ['profile', 'NODE_ENV'], ['profile', 'DEBUG'],
]);
assert.ok(broken.report.findings.every(finding => typeof finding.hint === 'string'));
const ready = check('ready.env');
assert.equal(ready.status, 0);
assert.equal(ready.report.status, 'pass');
assert.equal(ready.report.required, 7);
assert.deepEqual(ready.report.findings, []);
assert.deepEqual(check('ready.env', true), ready);
assert.deepEqual(check('broken.env', true), broken);
for (const name of files) assert.deepEqual(readFileSync(fixture(name)), before.get(name), 'Inputs must remain unchanged');
console.log('Service onboarding verified: six mistakes caught, corrected settings pass, file and stdin reports agree.');
