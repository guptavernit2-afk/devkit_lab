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

## Next, in priority order

1. Machine-readable reports with the same guarantee that values stay hidden.
2. Explicit optional settings and type rules, including boolean and port checks.
3. Detect unresolved variable references without executing or expanding shell code.
4. A documented GitHub Actions example using dummy fixtures and private inputs.
5. Better dotenv compatibility, starting with clearly specified multiline values.

## Later, after feedback

- An explicit deployment profile that can flag development-only settings.
- A local visual interface using the same checker, after the CLI is reliable.

## Existing supporting utilities

JSON formatting, validation and minification; URL and HTML form conversion;
timestamps; Base64 text conversion; SHA-256 checksums; UUID generation.
Keep these working, but prioritize checker improvements over unrelated tools.
