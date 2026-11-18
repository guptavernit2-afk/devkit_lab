export function validChoices(values) {
  return Array.isArray(values) && values.length > 0
    && values.every(value => typeof value === 'string' && value.trim().length > 0)
    && new Set(values).size === values.length;
}
