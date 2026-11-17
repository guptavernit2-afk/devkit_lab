import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, inspectSettings } from '../src/check.js';

test('multiline quoted settings retain contents and declaration line numbers', () => {
  const parsed = parseSettings('KEY="first\r\n#inside\r\nOTHER=inside\r\nlast" # comment\r\nNEXT=yes');
  assert.deepEqual(parsed.invalidLines, []);
  assert.equal(parsed.settings.get('KEY').value, 'first\n#inside\nOTHER=inside\nlast');
  assert.deepEqual(parsed.settings.get('NEXT').lines, [5]);
  assert.equal(parsed.settings.has('OTHER'), false);
});

test('multiline empty and duplicate findings use start lines', () => {
  const report = inspectSettings('KEY=', "KEY='\n \n'\nKEY=\"\n\"\n");
  assert.deepEqual(report.findings, [
    { code: 'duplicate', role: 'env', key: 'KEY', lines: [1, 4] },
    { code: 'empty', role: 'env', key: 'KEY', line: 4 },
  ]);
});

test('unterminated multiline content never becomes settings or leaks into findings', () => {
  const parsed = parseSettings('KEY="private\nSECRET=private');
  assert.deepEqual(parsed.invalidLines, [1]);
  assert.equal(parsed.settings.size, 0);
  assert.equal(parseSettings('KEY="a\\"b\nc"\nNEXT=yes').settings.get('KEY').value, 'a"b\nc');
});
