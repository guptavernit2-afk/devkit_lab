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
- Support quoted multiline settings with opening-line diagnostics.
- Detect reference cycles and report unsupported reference expressions.
- Load versioned JSON policies with explicit CLI overrides and safe errors.
- Read one settings input from stdin for generated configurations.
- Offer an opt-in Node.js production profile with documented DEBUG conventions.
- Validate HTTP endpoint syntax and project-specific allowed values.
- Explain manual fixes with optional text/JSON hints that hide values.
- Exercise a complete dummy service onboarding flow with file and stdin inputs.
- Diagnose policy read, encoding, JSON, and schema failures without leaking contents.
- Clear inherited optional/type rules explicitly from the CLI.
- Validate decimal integers and JSON syntax in structured environment settings.

## Next, in priority order

1. Exercise the checker against real project setup flows and turn reported gaps
   into regression fixtures (using dummy values only).
2. Gather feedback on fix hints and improve guidance for ambiguous findings.
3. Expand validation rules only when concrete project setup needs justify them.

## Later, after feedback

- Additional deployment profiles once concrete framework requirements are known.
- A local visual interface using the same checker, after the CLI is reliable.

## Existing supporting utilities

JSON formatting, validation and minification; URL and HTML form conversion;
timestamps; Base64 text conversion; SHA-256 checksums; UUID generation.
Keep these working, but prioritize checker improvements over unrelated tools.
