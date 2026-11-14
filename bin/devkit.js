#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { jsonCommand } from '../src/json.js';
import { urlCommand } from '../src/url.js';
import { timeCommand } from '../src/time.js';
import { base64Command } from '../src/base64.js';
import { hashCommand } from '../src/hash.js';
import { uuidCommand } from '../src/uuid.js';
import { checkCommand } from '../src/check.js';

export const commands = new Map([
  ['check', { description: 'Check project settings before deployment (check --help)', run: checkCommand }],
  ['uuid', { description: 'Generate random UUIDs (uuid --help)', run: uuidCommand }],
  ['hash', { description: 'Calculate SHA-256 checksums (hash --help)', run: hashCommand }],
  ['base64', { description: 'Encode or decode UTF-8 text (base64 --help)', run: base64Command }],
  ['json', { description: 'Format or validate JSON (json --help)', run: jsonCommand }],
  ['url', { description: 'Encode or decode a URL component (url --help)', run: urlCommand }],
  ['time', { description: 'Convert Unix timestamps and UTC dates (time --help)', run: timeCommand }],
]);

export function run(args) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h') {
    return ['devkit-lab — a local project setup checker and developer toolkit', '', 'Usage: devkit <command> [arguments]', '',
      ...Array.from(commands, ([name, entry]) => `  ${name.padEnd(12)} ${entry.description}`),
      '  --help       Show this help'].join('\n');
  }
  const entry = commands.get(command);
  if (!entry) throw new Error(`Unknown command: ${command}. Run devkit --help.`);
  return entry.run(rest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = run(process.argv.slice(2));
    const { output, exitCode = 0 } = typeof result === 'string' ? { output: result } : result;
    process.stdout.write(`${output}\n`);
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = error.exitCode ?? 1;
  }
}
