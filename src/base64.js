import { readFileSync } from 'node:fs';

const help = `Usage: devkit base64 <encode|decode> <text|--stdin>

Encode UTF-8 text or decode canonical, padded standard Base64 into UTF-8.
Piped input is read exactly, including trailing newlines.
Example: devkit base64 encode "hello"`;

export function base64Command(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const [action, value] = args;
  if (args.length !== 2 || !['encode', 'decode'].includes(action)) throw new Error(help);
  let input = value;
  if (value === '--stdin') {
    try {
      input = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(0));
    } catch (error) {
      if (error.code !== 'ERR_ENCODING_INVALID_ENCODED_DATA') throw error;
      throw new Error('Piped input is not valid UTF-8 text.');
    }
  }
  if (action === 'encode') {
    if (!input.isWellFormed()) throw new Error('Cannot encode invalid Unicode text.');
    return Buffer.from(input, 'utf8').toString('base64');
  }
  const bytes = Buffer.from(input, 'base64');
  if (bytes.toString('base64') !== input) {
    throw new Error('Expected canonical standard Base64 with padding and no whitespace.');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('Decoded bytes are not valid UTF-8 text.');
  }
}
