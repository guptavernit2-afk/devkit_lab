import { randomUUID } from 'node:crypto';

const help = `Usage: devkit uuid [--count <1-1000>]

Generate cryptographically random version 4 UUIDs, one per line.
Example: devkit uuid --count 5`;

export function uuidCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  let count = 1;
  if (args.length > 0) {
    if (args.length !== 2 || args[0] !== '--count') throw new Error(help);
    if (!/^[1-9]\d*$/.test(args[1])) throw new Error('Count must be an integer from 1 to 1000.');
    count = Number(args[1]);
    if (!Number.isSafeInteger(count) || count > 1000) throw new Error('Count must be an integer from 1 to 1000.');
  }
  return Array.from({ length: count }, () => randomUUID()).join('\n');
}
