import { readFileSync } from 'node:fs';

const name = /^[A-Za-z_][A-Za-z0-9_]*$/;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Only policy rules belong here: paths and file contents stay outside the config.
export function loadPolicy(path) {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(readFileSync(path));
    const policy = JSON.parse(text);
    if (!object(policy) || policy.schemaVersion !== 1 || Object.keys(policy).some(key => !['schemaVersion', 'optional', 'types', 'references', 'extras'].includes(key))) throw new Error();
    if (policy.optional !== undefined && (!Array.isArray(policy.optional) || policy.optional.some(key => typeof key !== 'string' || !name.test(key)) || new Set(policy.optional).size !== policy.optional.length)) throw new Error();
    if (policy.types !== undefined && (!object(policy.types) || Object.entries(policy.types).some(([key, type]) => !name.test(key) || !['boolean', 'port'].includes(type)))) throw new Error();
    if (policy.references !== undefined && !['check', 'ignore'].includes(policy.references)) throw new Error();
    if (policy.extras !== undefined && !['allow', 'error'].includes(policy.extras)) throw new Error();
    const options = new Map();
    if (policy.optional !== undefined) options.set('--optional', policy.optional.join(','));
    if (policy.types !== undefined) options.set('--types', Object.entries(policy.types).map(([key, type]) => `${key}:${type}`).join(','));
    for (const key of ['references', 'extras']) if (policy[key] !== undefined) options.set(`--${key}`, policy[key]);
    return options;
  } catch {
    const error = new Error('Cannot load policy: use readable UTF-8 JSON with schemaVersion 1 and valid optional, types, references, or extras rules.');
    error.exitCode = 2;
    throw error;
  }
}
