import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSettings, inspectSettings } from '../src/check.js';

test('large multiline values retain contents and resume at the next declaration', () => {
  const content = Array.from({ length: 12000 }, (_, i) => `dummy line ${i}`).join('\n');
  const parsed = parseSettings(`A="${content}"\nNEXT=ready`);
  assert.deepEqual(parsed.invalidLines, []);
  assert.equal(parsed.settings.get('A').value, content);
  assert.deepEqual(parsed.settings.get('NEXT').lines, [12001]);
  const unclosed = parseSettings(`A="${content}\nSECRET=dummy`);
  assert.deepEqual(unclosed.invalidLines, [1]);
  assert.equal(unclosed.settings.size, 0);
});

test('multiline quote scanning handles escaped quotes and backslashes at line boundaries', () => {
  const parsed = parseSettings('A="first\\\n"\nB="second\\"\nlast"\nC=ready');
  assert.deepEqual(parsed.invalidLines, []);
  assert.equal(parsed.settings.get('A').value, 'first\\\n');
  assert.equal(parsed.settings.get('B').value, 'second"\nlast');
  assert.equal(parsed.settings.get('C').value, 'ready');
});

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
