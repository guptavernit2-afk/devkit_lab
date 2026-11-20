import { readFileSync } from 'node:fs';
import { settingTypes } from './types.js';
import { validChoices } from './allowed.js';

const name = /^[A-Za-z_][A-Za-z0-9_]*$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Only policy rules belong here: paths and file contents stay outside the config.
export function loadPolicy(path) {
  let stage = 'read';
  try {
    const bytes = readFileSync(path);
    stage = 'encoding';
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    stage = 'json';
    const policy = JSON.parse(text);
    stage = 'schema';
    if (!object(policy) || policy.schemaVersion !== 1 || Object.keys(policy).some(key => !['schemaVersion', 'optional', 'types', 'references', 'extras', 'profile', 'allowed'].includes(key))) throw new Error();
    if (policy.allowed !== undefined && (!object(policy.allowed) || Object.entries(policy.allowed).some(([key, values]) => !name.test(key) || !validChoices(values)))) throw new Error();
    if (policy.optional !== undefined && (!Array.isArray(policy.optional) || policy.optional.some(key => typeof key !== 'string' || !name.test(key)) || new Set(policy.optional).size !== policy.optional.length)) throw new Error();
    if (policy.types !== undefined && (!object(policy.types) || Object.entries(policy.types).some(([key, type]) => !name.test(key) || !settingTypes.includes(type)))) throw new Error();
    if (policy.references !== undefined && !['check', 'ignore'].includes(policy.references)) throw new Error();
    if (policy.extras !== undefined && !['allow', 'error'].includes(policy.extras)) throw new Error();
    if (policy.profile !== undefined && !['none', 'node-production'].includes(policy.profile)) throw new Error();
    const options = new Map();
    if (policy.allowed !== undefined) options.set('--allowed', new Map(Object.entries(policy.allowed)));
    if (policy.optional !== undefined) options.set('--optional', policy.optional.join(','));
    if (policy.types !== undefined) options.set('--types', Object.entries(policy.types).map(([key, type]) => `${key}:${type}`).join(','));
    for (const key of ['references', 'extras', 'profile']) if (policy[key] !== undefined) options.set(`--${key}`, policy[key]);
    return options;
  } catch {
    const messages = {
      read: 'Cannot read policy file. Check the path and permissions.',
      encoding: 'Policy file must use valid UTF-8 encoding.',
      json: 'Policy file must contain valid JSON. Check commas, quotes, and brackets.',
      schema: 'Policy schema is invalid. Use schemaVersion 1 and valid optional, types, references, extras, profile, or allowed rules.',
    };
    const error = new Error(messages[stage]);
    error.exitCode = 2;
    throw error;
  }
}
