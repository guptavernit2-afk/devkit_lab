import { readFileSync } from 'node:fs';

const help = `Usage: devkit json <format|validate> <input>

Input: a JSON string, --file <path>, or --stdin
Examples:
  devkit json format '{"ready":true}'
  devkit json validate --file data.json`;

export function jsonCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const [action, ...input] = args;
  if (!['format', 'validate'].includes(action)) throw new Error(help);
  let source;
  if (input.length === 1 && input[0] === '--stdin') {
    source = readFileSync(0, 'utf8');
  } else if (input.length === 2 && input[0] === '--file') {
    source = readFileSync(input[1], 'utf8');
  } else if (input.length === 1 && !input[0].startsWith('--')) {
    source = input[0];
  } else {
    throw new Error(help);
  }
  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`);
  }
  return action === 'validate' ? 'Valid JSON' : JSON.stringify(parsed, null, 2);
}
