# Roadmap: project setup checker

Help developers catch configuration mistakes before running or deploying apps.
Choose work by concrete user problems. Each coherent feature or fix includes
tests and documentation and ships through a PR after local checks and CI pass.
PR and commit counts are secondary to useful, reliable behavior.

## V1 delivered

- Compare required names in `.env.example` with an actual settings file.
- Report missing names, empty values, and duplicate declarations in either file.
- Report malformed declarations and line numbers without exposing values.
- Read UTF-8 files locally, without modifying files or the shell environment.
- Return useful CI exit codes and include broken and corrected demo files.
- Emit versioned JSON reports for scripts and CI without exposing values.
- Support optional settings, explicit boolean/port rules, and unexpected-key checks.
- Detect direct missing/empty variable references without expanding values.
- Demonstrate CI integration with passing and deliberately broken dummy fixtures.

## Next, in priority order

1. Better dotenv compatibility, starting with clearly specified multiline values.
2. Detect reference cycles and distinguish unsupported reference syntax.
3. File-based policy configuration for larger projects, with safe diagnostics.

## Later, after feedback

- An explicit deployment profile that can flag development-only settings.
- A local visual interface using the same checker, after the CLI is reliable.

## Existing supporting utilities

JSON formatting, validation and minification; URL and HTML form conversion;
timestamps; Base64 text conversion; SHA-256 checksums; UUID generation.
Keep these working, but prioritize checker improvements over unrelated tools.
