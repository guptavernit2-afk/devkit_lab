import { createHash } from 'node:crypto';
import { openSync, readSync, closeSync } from 'node:fs';

const help = `Usage: devkit hash <text|--stdin|--file path>

Print a SHA-256 checksum as lowercase hexadecimal.
Text uses UTF-8; files and stdin are hashed as exact bytes, including newlines.
Example: devkit hash --file archive.zip`;

export function hashCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const file = args.length === 2 && args[0] === '--file';
  const stdin = args.length === 1 && args[0] === '--stdin';
  const text = args.length === 1 && !args[0].startsWith('--');
  if (!file && !stdin && !text) throw new Error(help);
  const hash = createHash('sha256');
  if (text) {
    if (!args[0].isWellFormed()) throw new Error('Cannot hash invalid Unicode text.');
    return hash.update(args[0], 'utf8').digest('hex');
  }
  const fd = file ? openSync(args[1], 'r') : 0;
  try {
    const buffer = Buffer.alloc(64 * 1024);
    let count;
    while ((count = readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      hash.update(buffer.subarray(0, count));
    }
    return hash.digest('hex');
  } finally {
    if (file) closeSync(fd);
  }
}
