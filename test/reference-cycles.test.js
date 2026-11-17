import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSettings } from '../src/check.js';
import { cycleMembers } from '../src/references.js';

test('reference checks detect self loops and multi-key cycles without exposing values', () => {
  const report = inspectSettings('A=\nB=\nC=\nD=', 'A=${B}\nB=private-${A}\nC=${C}\nD=${A}', { references: true });
  assert.deepEqual(report.findings.map(f => [f.code, f.key]), [['cycle', 'A'], ['cycle', 'B'], ['cycle', 'C']]);
  assert.doesNotMatch(JSON.stringify(report), /private/);
  assert.equal(inspectSettings('A=', 'A=${A}').findings.length, 0);
});

test('acyclic shared dependencies and deep chains do not overflow', () => {
  const settings = new Map(Array.from({ length: 15000 }, (_, i) => [String(i), { references: i ? [String(i - 1)] : [] }]));
  assert.equal(cycleMembers(settings).size, 0);
  assert.equal(inspectSettings('A=\nB=\nC=', 'A=${C}\nB=${C}\nC=ok', { references: true }).findings.length, 0);
});

test('all members of overlapping cycles are reported', () => {
  const report = inspectSettings('A=\nB=\nC=', 'A=${B}${C}\nB=${A}\nC=${B}', { references: true });
  assert.deepEqual(report.findings.map(f => f.key), ['A', 'B', 'C']);
});
