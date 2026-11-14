const help = `Usage: devkit url <encode|decode|form-encode|form-decode> <text>

Encodes a single URL component, such as a query parameter value.
Decode preserves literal + characters; this is not form-urlencoded decoding.
Use form-encode/form-decode for individual HTML form values (space becomes +).
Example: devkit url encode "hello world & friends"`;

export function urlCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const [action, value] = args;
  if (args.length !== 2 || !['encode', 'decode', 'form-encode', 'form-decode'].includes(action)) throw new Error(help);
  const decoding = action === 'decode' || action === 'form-decode';
  try {
    if (action === 'form-encode') {
      return encodeURIComponent(value).replace(/[!'()~]/g, char =>
        `%${char.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, '+');
    }
    if (action === 'form-decode') return decodeURIComponent(value.replace(/\+/g, ' '));
    return action === 'encode' ? encodeURIComponent(value) : decodeURIComponent(value);
  } catch {
    throw new Error(decoding
      ? 'Cannot decode: input contains malformed percent escapes or invalid UTF-8.'
      : 'Cannot encode: input contains an invalid Unicode sequence.');
  }
}
