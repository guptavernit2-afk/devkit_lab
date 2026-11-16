import { readFileSync } from 'node:fs';

const help = `Usage: devkit check [--example <path>] [--env <path>] [--format text|json]

Compare .env.example with .env (the default paths).
Report missing settings, empty values, and duplicate keys without printing values.
All keys in the example are required. Files are read locally and never changed.
Output defaults to text; --format json emits a versioned report without values.
Options: --optional KEY1,KEY2 allows listed example keys to be absent.
         --types DEBUG:boolean,PORT:port validates declared types.
         --references check|ignore checks direct references (default: ignore).
         --extras allow|error rejects undeclared keys (default: allow).
Exit codes: 0 = clean, 1 = findings, 2 = invalid arguments or unreadable files.
Example: devkit check --example .env.example --env .env.production`;

class CheckInputError extends Error {
  exitCode = 2;
}

function parseValue(source) {
  const text = source.trim();
  const quote = text[0];
  if (quote === '`') return null;
  if (quote !== '"' && quote !== "'") return text.split('#')[0].trim();
  let value = '';
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char === quote) {
      if (!/^[ \t]*(?:#.*)?$/.test(text.slice(i + 1))) return null;
      return value;
    }
    if (quote === '"' && char === '\\' && i + 1 < text.length) {
      const next = text[++i];
      value += ({ n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\' })[next] ?? `\\${next}`;
    } else {
      value += char;
    }
  }
  return null;
}

export function parseSettings(source) {
  const settings = new Map();
  const invalidLines = [];
  const lines = source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  for (const [index, line] of lines.entries()) {
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)$/.exec(line);
    const value = match ? parseValue(match[2]) : null;
    if (!match || value === null) {
      invalidLines.push(index + 1);
      continue;
    }
    const key = match[1];
    const previous = settings.get(key);
    const references = match[2].trim().startsWith("'") ? []
      : [...value.matchAll(/(?<!\\)\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(match => match[1]);
    settings.set(key, { value, references, lines: [...(previous?.lines ?? []), index + 1] });
  }
  return { settings, invalidLines };
}

export function inspectSettings(exampleText, envText, { optional = [], types = new Map(), references = false, extras = false } = {}) {
  const example = parseSettings(exampleText);
  const actual = parseSettings(envText);
  const optionalKeys = new Set(optional);
  for (const [key, type] of types) {
    if (!example.settings.has(key) || !['boolean', 'port'].includes(type)) {
      throw new CheckInputError('Type rules require example keys and boolean or port types.');
    }
  }
  for (const key of optionalKeys) {
    if (!example.settings.has(key)) throw new CheckInputError('Optional keys must be defined in the example file.');
  }
  const findings = [];
  for (const [role, parsed] of [['example', example], ['env', actual]]) {
    for (const line of parsed.invalidLines) {
      findings.push({ code: 'invalid', role, line });
    }
    for (const [key, entry] of parsed.settings) {
      if (entry.lines.length > 1) findings.push({ code: 'duplicate', role, key, lines: entry.lines });
    }
  }
  if (example.settings.size === 0) findings.push({ code: 'no-requirements', role: 'example' });
  for (const key of example.settings.keys()) {
    if (!optionalKeys.has(key) && !actual.settings.has(key)) findings.push({ code: 'missing', role: 'env', key });
  }
  for (const [key, entry] of actual.settings) {
    if (extras && !example.settings.has(key)) findings.push({ code: 'unexpected', role: 'env', key, line: entry.lines.at(-1) });
    if (references && entry.references.some(name => !actual.settings.get(name)?.value.trim())) {
      findings.push({ code: 'unresolved', role: 'env', key, line: entry.lines.at(-1) });
    }
    if (!entry.value.trim()) findings.push({ code: 'empty', role: 'env', key, line: entry.lines.at(-1) });
    const type = types.get(key);
    const value = entry.value;
    if (type && value.trim() && !(type === 'boolean' ? /^(true|false)$/.test(value)
      : /^[1-9]\d*$/.test(value) && Number(value) <= 65535)) {
      findings.push({ code: 'type', role: 'env', key, line: entry.lines.at(-1), expected: type });
    }
  }
  return { required: example.settings.size - optionalKeys.size, findings };
}

function readSettings(path, role) {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(path));
  } catch {
    throw new CheckInputError(`Cannot read ${role} settings file as UTF-8. Check the path, permissions, and encoding.`);
  }
}

export function checkCommand(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return help;
  const options = new Map([['--example', '.env.example'], ['--env', '.env'], ['--format', 'text'], ['--optional', ''], ['--types', ''], ['--references', 'ignore'], ['--extras', 'allow']]);
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!options.has(flag) || seen.has(flag) || !value || value.startsWith('--')) {
      throw new CheckInputError(help);
    }
    options.set(flag, value);
    seen.add(flag);
  }
  if (!['text', 'json'].includes(options.get('--format'))) {
    throw new CheckInputError('Format must be text or json.');
  }
  const optional = options.get('--optional') ? options.get('--optional').split(',') : [];
  if (optional.some(key => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) || new Set(optional).size !== optional.length) {
    throw new CheckInputError('Optional keys must be unique valid names separated by commas.');
  }
  const types = new Map();
  for (const rule of options.get('--types') ? options.get('--types').split(',') : []) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*):(boolean|port)$/.exec(rule);
    if (!match || types.has(match[1])) throw new CheckInputError('Types must be unique KEY:boolean or KEY:port rules separated by commas.');
    types.set(match[1], match[2]);
  }
  if (!['check', 'ignore'].includes(options.get('--references'))) throw new CheckInputError('References must be check or ignore.');
  if (!['allow', 'error'].includes(options.get('--extras'))) throw new CheckInputError('Extras must be allow or error.');
  const report = inspectSettings(readSettings(options.get('--example'), 'example'), readSettings(options.get('--env'), 'env'), { optional, types, references: options.get('--references') === 'check', extras: options.get('--extras') === 'error' });
  if (options.get('--format') === 'json') {
    return {
      output: JSON.stringify({
        schemaVersion: 1,
        status: report.findings.length ? 'fail' : 'pass',
        required: report.required,
        issueCount: report.findings.length,
        findings: report.findings,
      }, null, 2),
      exitCode: report.findings.length ? 1 : 0,
    };
  }
  const output = ['devkit-lab — project setup check', ''];
  for (const finding of report.findings) {
    const { code, role, key, line, lines } = finding;
    if (code === 'invalid') output.push(`INVALID ${role}: line ${line} — expected a single-line KEY=value declaration.`);
    if (code === 'duplicate') output.push(`DUPLICATE ${role}: ${key} (lines ${lines.join(', ')})`);
    if (code === 'missing') output.push(`MISSING env: ${key}`);
    if (code === 'empty') output.push(`EMPTY env: ${key} (line ${line})`);
    if (code === 'unexpected') output.push(`UNEXPECTED env: ${key} (line ${line}) — not declared in the example.`);
    if (code === 'unresolved') output.push(`UNRESOLVED env: ${key} (line ${line}) — a referenced setting is missing or empty.`);
    if (code === 'type') output.push(`TYPE env: ${key} (line ${line}) — expected ${finding.expected}.`);
    if (code === 'no-requirements') output.push('INVALID example: no settings defined; add the required keys.');
  }
  output.push(report.findings.length
    ? `\n${report.findings.length} issue(s) found. Setting values are hidden.`
    : `PASS: ${report.required} required setting(s) present and non-empty; no duplicate or invalid declarations.`);
  return { output: output.join('\n'), exitCode: report.findings.length ? 1 : 0 };
}
