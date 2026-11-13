const help = `Usage:
  devkit time from-unix <integer> [--ms]
  devkit time to-unix <UTC-date> [--ms]

Unix values use seconds by default; --ms selects milliseconds.
UTC dates use YYYY-MM-DDTHH:mm:ss[.SSS]Z (fraction: 1 to 3 digits).
Example: devkit time from-unix 0`;

export function timeCommand(args) {
  if (args.length === 1 && args[0] === '--help') return help;
  const [action, value, unit] = args;
  if (args.length < 2 || args.length > 3 || (args.length === 3 && unit !== '--ms')
      || !['from-unix', 'to-unix'].includes(action)) throw new Error(help);
  const scale = unit === '--ms' ? 1 : 1000;
  if (action === 'from-unix') {
    if (!/^-?\d+$/.test(value)) throw new Error('Unix timestamp must be an integer.');
    const timestamp = Number(value);
    const date = new Date(timestamp * scale);
    if (!Number.isSafeInteger(timestamp) || Number.isNaN(date.getTime())) {
      throw new Error('Unix timestamp is outside the supported date range.');
    }
    return date.toISOString();
  }
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) throw new Error('Expected a UTC date: YYYY-MM-DDTHH:mm:ss[.SSS]Z.');
  const normalized = `${match[1]}.${(match[2] ?? '').padEnd(3, '0')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== normalized) {
    throw new Error('Invalid calendar date or time.');
  }
  return String(Math.floor(date.getTime() / scale));
}
