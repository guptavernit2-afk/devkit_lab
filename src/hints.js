const hints = {
  invalid: 'Use KEY=value syntax; close quotes and keep trailing text in a comment.',
  duplicate: 'Keep one declaration for this key in the indicated file.',
  missing: 'Add this key to the actual settings file, or mark it optional in the policy if the app permits omission.',
  empty: 'Supply a non-blank value; optional settings must still be non-empty when present.',
  cycle: 'Remove a circular dependency by replacing a reference with a literal or an independent setting.',
  'unsupported-reference': 'Use ${NAME} references; single-quote text that should remain literal.',
  unresolved: 'Define every referenced key with a non-blank value in the actual settings file; shell variables are not consulted.',
  unexpected: 'Correct a misspelled name, remove the unused key, or declare the intended key in the example.',
  allowed: 'Choose an exact, case-sensitive value from this key\'s allowed list in the policy file.',
  profile: 'For node-production, set NODE_ENV to production and set DEBUG to false if present.',
  'no-requirements': 'Add at least one KEY=value declaration to the example file.',
};
const typeHints = {
  json: 'Use valid JSON; single-quote the dotenv value to preserve JSON quotes and backslashes. This checks syntax only.',
  integer: 'Use a decimal integer from -9007199254740991 to 9007199254740991, without a plus sign, leading zeros, or exponent notation.',
  boolean: 'Use the literal true or false, in lowercase.',
  port: 'Use a decimal integer from 1 to 65535 without leading zeros.',
  'http-url': 'Use an absolute HTTP/HTTPS URL without whitespace, credentials, or interpolation.',
};

export function findingHint(finding) {
  return finding.code === 'type' ? typeHints[finding.expected] ?? 'Check the declared type rule.'
    : hints[finding.code] ?? 'Review the project policy and checker documentation.';
}
