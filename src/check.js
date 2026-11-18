import { readFileSync } from 'node:fs';
import { cycleMembers, inspectReferences } from './references.js';
import { loadPolicy } from './policy.js';
import { settingTypes, matchesType } from './types.js';
import { validChoices } from './allowed.js';
import { findingHint } from './hints.js';

const help = `Usage: devkit check [--example <path>] [--env <path>] [--format text|json]

Compare .env.example with .env (the default paths).
Report missing settings, empty values, and duplicate keys without printing values.
Example keys are required unless optional. Files are read locally and never changed.
Output defaults to text; --format json emits a versioned report without values.
Options: --optional KEY1,KEY2 allows listed example keys to be absent.
         --config <path> loads policy rules from a JSON file; CLI rules override.
         --env - or --example - reads one settings input from standard input.
         --types DEBUG:boolean,PORT:port,API_URL:http-url validates declared types.
         --references check|ignore checks direct references (default: ignore).
         --extras allow|error rejects undeclared keys (default: allow).
         --profile none|node-production enables explicit deployment rules.
         --explain on|off adds value-free fix guidance (default: off).
Exit codes: 0 = clean, 1 = findings, 2 = invalid arguments or unreadable files.
Example: devkit check --example .env.example --env .env.production`;

class CheckInputError extends Error {
  exitCode = 2;
}

function parseValue(source) {
  const text = source.trim();
  const quote = text[0];
  if (quote === '`') return null;
  if (quote !== '"' && quote !== "'") {
    const value = text.split('#')[0].trim();
    return { value, referenceSource: value, literal: false };
  }
  let value = '';
  for (let i = 1; i < text.length; i++) {
    const char = text[i];
    if (char === quote) {
      if (!/^[ \t]*(?:#.*)?$/.test(text.slice(i + 1))) return null;
      return { value, referenceSource: text.slice(1, i), literal: quote === "'" };
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
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const startLine = index + 1;
    if (/^\s*(?:#.*)?$/.test(line)) continue;
    const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=(.*)$/.exec(line);
    let raw = match?.[2];
    if (raw && /^[ \t]*['"]/.test(raw)) {
      const quote = raw.trimStart()[0];
      const chunks = [raw];
      let text = raw.trimStart();
      let offset = 1;
      let closed = false;
      while (!closed) {
        for (let i = offset; i < text.length; i++) {
          if (quote === '"' && text[i] === '\\') { i++; continue; }
          if (text[i] === quote) { closed = true; break; }
        }
        if (closed || index + 1 >= lines.length) break;
        text = lines[++index];
        chunks.push(text);
        offset = 0;
      }
      raw = chunks.join('\n');
    }
    const parsed = match ? parseValue(raw) : null;
    if (!match || parsed === null) {
      invalidLines.push(startLine);
      continue;
    }
    const key = match[1];
    const previous = settings.get(key);
    const referenceInfo = parsed.literal ? { references: [], unsupported: false } : inspectReferences(parsed.referenceSource);
    settings.set(key, { value: parsed.value, ...referenceInfo, lines: [...(previous?.lines ?? []), startLine] });
  }
  return { settings, invalidLines };
}

export function inspectSettings(exampleText, envText, { optional = [], types = new Map(), allowed = new Map(), references = false, extras = false, profile = 'none' } = {}) {
  if (!['none', 'node-production'].includes(profile)) throw new CheckInputError('Profile must be none or node-production.');
  const example = parseSettings(exampleText);
  const actual = parseSettings(envText);
  const optionalKeys = new Set(optional);
  for (const [key, values] of allowed) {
    if (!example.settings.has(key) || !validChoices(values)) throw new CheckInputError('Allowed-value rules require example keys and non-empty lists of unique non-blank strings.');
  }
  for (const [key, type] of types) {
    if (!example.settings.has(key) || !settingTypes.includes(type)) {
      throw new CheckInputError('Type rules require example keys and boolean, port, or http-url types.');
    }
  }
  for (const key of optionalKeys) {
    if (!example.settings.has(key)) throw new CheckInputError('Optional keys must be defined in the example file.');
  }
  const findings = [];
  const cycles = references ? cycleMembers(actual.settings) : new Set();
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
    if (references && entry.unsupported) findings.push({ code: 'unsupported-reference', role: 'env', key, line: entry.lines.at(-1) });
    if (cycles.has(key)) findings.push({ code: 'cycle', role: 'env', key, line: entry.lines.at(-1) });
    if (extras && !example.settings.has(key)) findings.push({ code: 'unexpected', role: 'env', key, line: entry.lines.at(-1) });
    if (references && entry.references.some(name => !actual.settings.get(name)?.value.trim())) {
      findings.push({ code: 'unresolved', role: 'env', key, line: entry.lines.at(-1) });
    }
    if (!entry.value.trim()) findings.push({ code: 'empty', role: 'env', key, line: entry.lines.at(-1) });
    const type = types.get(key);
    const value = entry.value;
    if (allowed.has(key) && value.trim() && !allowed.get(key).includes(value)) {
      findings.push({ code: 'allowed', role: 'env', key, line: entry.lines.at(-1) });
    }
    if (type && value.trim() && !matchesType(value, type)) {
      findings.push({ code: 'type', role: 'env', key, line: entry.lines.at(-1), expected: type });
    }
  }
  if (profile === 'node-production') {
    for (const [key, expected, required] of [['NODE_ENV', 'production', true], ['DEBUG', 'false', false]]) {
      const entry = actual.settings.get(key);
      if ((!entry && required) || (entry && entry.value !== expected)) {
        findings.push({ code: 'profile', role: 'env', key, ...(entry ? { line: entry.lines.at(-1) } : {}), profile });
      }
    }
  }
  return { required: example.settings.size - optionalKeys.size, findings };
}

function readSettings(path, role) {
  try {
    if (path === '-' && process.stdin.isTTY) throw new Error();
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(readFileSync(path === '-' ? 0 : path));
  } catch {
    throw new CheckInputError(`Cannot read ${role} settings as UTF-8. Check the path, permissions, encoding, or piped input.`);
  }
}

export function checkCommand(args) {
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) return help;
  const options = new Map([['--example', '.env.example'], ['--env', '.env'], ['--format', 'text'], ['--optional', ''], ['--types', ''], ['--references', 'ignore'], ['--extras', 'allow'], ['--config', ''], ['--profile', 'none'], ['--explain', 'off']]);
  const seen = new Set();
  let allowed = new Map();
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];
    if (!options.has(flag) || seen.has(flag) || !value || value.startsWith('--')) {
      throw new CheckInputError(help);
    }
    options.set(flag, value);
    seen.add(flag);
  }
  if (options.get('--config')) {
    for (const [flag, value] of loadPolicy(options.get('--config'))) {
      if (flag === '--allowed') allowed = value;
      else if (!seen.has(flag)) options.set(flag, value);
    }
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
    const match = /^([A-Za-z_][A-Za-z0-9_]*):(boolean|port|http-url)$/.exec(rule);
    if (!match || types.has(match[1])) throw new CheckInputError('Types must be unique KEY:boolean, KEY:port, or KEY:http-url rules separated by commas.');
    types.set(match[1], match[2]);
  }
  if (!['check', 'ignore'].includes(options.get('--references'))) throw new CheckInputError('References must be check or ignore.');
  if (!['allow', 'error'].includes(options.get('--extras'))) throw new CheckInputError('Extras must be allow or error.');
  if (!['none', 'node-production'].includes(options.get('--profile'))) throw new CheckInputError('Profile must be none or node-production.');
  if (!['on', 'off'].includes(options.get('--explain'))) throw new CheckInputError('Explain must be on or off.');
  if (options.get('--example') === '-' && options.get('--env') === '-') throw new CheckInputError('Only one settings input can use standard input.');
  const report = inspectSettings(readSettings(options.get('--example'), 'example'), readSettings(options.get('--env'), 'env'), { optional, types, allowed, references: options.get('--references') === 'check', extras: options.get('--extras') === 'error', profile: options.get('--profile') });
  if (options.get('--explain') === 'on') report.findings = report.findings.map(finding => ({ ...finding, hint: findingHint(finding) }));
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
    if (code === 'invalid') output.push(`INVALID ${role}: line ${line} — expected a valid KEY=value declaration.`);
    if (code === 'duplicate') output.push(`DUPLICATE ${role}: ${key} (lines ${lines.join(', ')})`);
    if (code === 'missing') output.push(`MISSING env: ${key}`);
    if (code === 'empty') output.push(`EMPTY env: ${key} (line ${line})`);
    if (code === 'cycle') output.push(`CYCLE env: ${key} (line ${line}) — circular setting reference.`);
    if (code === 'unsupported-reference') output.push(`UNSUPPORTED REFERENCE env: ${key} (line ${line}) — use braced names or single-quote literal text.`);
    if (code === 'profile') output.push(`PROFILE env: ${key}${line ? ` (line ${line})` : ''} — ${finding.profile} requires NODE_ENV=production and DEBUG=false when DEBUG is present.`);
    if (code === 'unexpected') output.push(`UNEXPECTED env: ${key} (line ${line}) — not declared in the example.`);
    if (code === 'unresolved') output.push(`UNRESOLVED env: ${key} (line ${line}) — a referenced setting is missing or empty.`);
    if (code === 'type') output.push(`TYPE env: ${key} (line ${line}) — expected ${finding.expected}.`);
    if (code === 'allowed') output.push(`ALLOWED env: ${key} (line ${line}) — choose a value permitted by the project policy.`);
    if (code === 'no-requirements') output.push('INVALID example: no settings defined; add the required keys.');
    if (finding.hint) output.push(`  Fix: ${finding.hint}`);
  }
  output.push(report.findings.length
    ? `\n${report.findings.length} issue(s) found. Setting values are hidden.`
    : `PASS: ${report.required} required setting(s) present and non-empty; no duplicate or invalid declarations.`);
  return { output: output.join('\n'), exitCode: report.findings.length ? 1 : 0 };
}
