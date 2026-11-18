export const settingTypes = ['boolean', 'port', 'http-url'];

export function matchesType(value, type) {
  if (type === 'boolean') return /^(true|false)$/.test(value);
  if (type === 'port') return /^[1-9]\d*$/.test(value) && Number(value) <= 65535;
  if (type === 'http-url') {
    // Reject URL-parser repairs, unresolved interpolation, and embedded credentials.
    if (!/^https?:\/\//i.test(value) || /[\s\\]/.test(value) || value.includes('${')) return false;
    try {
      const url = new URL(value);
      const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/)[0];
      return Boolean(authority && url.hostname && !authority.includes('@'));
    } catch { return false; }
  }
  return false;
}
