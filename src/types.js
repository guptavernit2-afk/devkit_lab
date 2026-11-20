export const settingTypes = ['boolean', 'port', 'http-url', 'integer'];

export function matchesType(value, type) {
  if (type === 'integer') return /^(0|-?[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));
  if (type === 'boolean') return /^(true|false)$/.test(value);
  if (type === 'port') return /^[1-9]\d*$/.test(value) && Number(value) <= 65535;
  if (type === 'http-url') {
    // Reject URL-parser repairs, unresolved interpolation, and embedded credentials.
    if (!/^https?:\/\//i.test(value) || /[\s\u0000-\u001f\u007f\\]/.test(value) || value.includes('${')) return false;
    try {
      const url = new URL(value);
      const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/)[0];
      return Boolean(authority && url.hostname && !authority.includes('@'));
    } catch { return false; }
  }
  return false;
}
