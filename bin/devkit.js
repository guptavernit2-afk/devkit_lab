#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export const commands = new Map();

export function run(args) {
  const [command, ...rest] = args;
  if (!command || command === '--help' || command === '-h') {
    return ['devkit-lab — small tools for everyday development', '', 'Usage: devkit <command> [arguments]', '',
      ...Array.from(commands, ([name, entry]) => `  ${name.padEnd(12)} ${entry.description}`),
      '  --help       Show this help'].join('\n');
  }
  const entry = commands.get(command);
  if (!entry) throw new Error(`Unknown command: ${command}. Run devkit --help.`);
  return entry.run(rest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(`${run(process.argv.slice(2))}\n`);
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
