import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../bin/devkit.js', import.meta.url));
const example = fileURLToPath(new URL('../examples/setup/.env.example', import.meta.url));
function check(name) {
  const env = fileURLToPath(new URL(`../examples/setup/${name}.env`, import.meta.url));
  return spawnSync(process.execPath, [cli, 'check', '--example', example, '--env', env,
    '--format', 'json', '--types', 'DEBUG:boolean', '--references', 'check', '--extras', 'error'], { encoding: 'utf8' });
}

const ready = check('ready');
assert.equal(ready.status, 0, 'Corrected demo must pass');
assert.equal(ready.stderr, '');
assert.equal(JSON.parse(ready.stdout).status, 'pass');
const broken = check('broken');
assert.equal(broken.status, 1, 'Broken demo must fail with findings, not an input error');
assert.equal(broken.stderr, '');
const report = JSON.parse(broken.stdout);
assert.equal(report.issueCount, 3);
assert.deepEqual(report.findings.map(f => f.code), ['duplicate', 'missing', 'empty']);
console.log('Setup-check CI demo passed: corrected settings accepted; all three deliberate mistakes caught.');
