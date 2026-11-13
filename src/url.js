const help = `Usage: devkit url <encode|decode> <text>

Encodes a single URL component, such as a query parameter value.
Decode preserves literal + characters; this is not form-urlencoded decoding.
Example: devkit url encode "hello world & friends"`;

export function urlCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const [action, value] = args;
  if (args.length !== 2 || !['encode', 'decode'].includes(action)) throw new Error(help);
  try {
    return action === 'encode' ? encodeURIComponent(value) : decodeURIComponent(value);
  } catch {
    throw new Error(action === 'decode'
      ? 'Cannot decode: input contains malformed percent escapes or invalid UTF-8.'
      : 'Cannot encode: input contains an invalid Unicode sequence.');
  }
}
