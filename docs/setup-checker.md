# Project setup checker

Catch settings mistakes before starting or deploying an app. The checker reads
two UTF-8 files locally and never modifies them, loads them into your shell,
makes network requests, or prints their values.

## Try the included demo

From the repository directory:

```sh
node bin/devkit.js check --example examples/setup/.env.example --env examples/setup/broken.env
```

Expected report (exit code 1):

```text
devkit-lab — project setup check

DUPLICATE env: DEBUG (lines 3, 4)
MISSING env: EMAIL_API_KEY
EMPTY env: DATABASE_URL (line 2)

3 issue(s) found. Setting values are hidden.
```

Now check the corrected demo file:

```sh
node bin/devkit.js check --example examples/setup/.env.example --env examples/setup/ready.env
```

This passes with exit code 0. These are dummy settings: a pass means the file
structure is consistent, not that the credentials work or an app is deployable.

## Check your project

List all required names in `.env.example`. Empty example values are placeholders
and are allowed. Put actual values in `.env`, keeping that file out of Git.

```sh
node /path/to/devkit_lab/bin/devkit.js check
```

Run from your app directory; default paths are relative to the current working
directory. Alternatively, pass `--example <path>` and `--env <path>` explicitly.
Quote paths containing spaces. Each option may appear once.

The report identifies:

- **MISSING:** a key in the example is absent from the actual file.
- **EMPTY:** an actual value is blank or whitespace-only, including `KEY=`,
  `KEY=""`, and `KEY='  '`. `0` and `false` are non-empty. Extra keys are allowed,
  but an extra key with an empty value is still flagged.
- **DUPLICATE:** a name appears more than once in either file, even if its values
  match. All declaration line numbers are shown. The last valid declaration
  determines the value checked for emptiness; the duplicate still fails.
- **INVALID:** a malformed declaration or an example defining no settings.

Names are case-sensitive on every platform. The shell environment is ignored,
so a missing file setting cannot be accidentally supplied by your terminal.
Reports show names and line numbers; values and malformed source lines are
omitted, including in error messages.

## Supported file syntax

Settings support single-line and quoted multiline declarations:

```dotenv
# Comments and blank lines are allowed.
export PORT = 3000
DEBUG=false # Inline comments are allowed.
MESSAGE="a # character inside quotes"
PATH_VALUE='literal\path'
```

- Names must match `[A-Za-z_][A-Za-z0-9_]*`.
- Spaces around names, `=`, and unquoted values are ignored.
- `#` starts a comment outside quotes; quote values containing literal `#`.
- Single-quoted values are literal. Double quotes support `\n`, `\r`, `\t`,
  `\"`, and `\\`; unknown backslash sequences are preserved.
- UTF-8 with one leading BOM and Windows or Unix line endings is accepted.
- Backtick quoting and shell commands are unsupported.
  Files are never executed. Variable references such as `${OTHER_KEY}` remain
  literal text; opt-in reference checks verify dependencies without expanding them.

This is a documented subset rather than a replacement for every dotenv loader.
By default it checks presence, emptiness, duplicates, and syntax. Optional
settings, boolean/port types, direct references, and unexpected keys can be
checked with the policies below. Recursively expanded values and credential
validity are not validated. HTTP endpoint syntax and production conventions require opting in
to the explicit profile described below.

## CI exit codes

### Unexpected settings

`devkit check --extras error` flags actual-file names not declared in the example,
which helps catch misspelled settings. Default `allow` preserves existing behavior.
Keys are case-sensitive; declare every allowed name, including optional ones,
before enabling this policy. JSON adds `unexpected` with `role`, `key`, and `line`.
Empty and duplicate checks still apply, and values remain hidden.

### Direct variable references

`devkit check --references check` flags a setting containing `${NAME}` when the
referenced setting is missing or empty in the actual file. Default `ignore`
preserves previous behavior. Single-quoted literal values, comments, and
backslash-escaped references are ignored. Shell variables are never consulted.
The `unresolved` finding includes only `role`, `key`, and `line`; referenced names
and surrounding text are omitted. Values are never expanded. This is a direct
presence check without recursive expansion. Unsupported `$NAME` and
`${NAME:-fallback}` syntax produces a finding. Type rules check literal values,
not expanded results.

Reference checks also detect circular dependencies, including self references.
Each participating key receives a `cycle` finding with its declaration line;
values and dependency paths are not printed. A key merely pointing into a cycle
is not itself reported as a cycle member. Values are never expanded.

### Explicit types

`devkit check --types DEBUG:boolean,PORT:port` validates selected example keys.
Boolean values must be exactly `true` or `false`; ports must be decimal integers
from 1 to 65535 without signs, leading zeros, spaces inside quotes, or exponents.
The `http-url` type is documented in HTTP endpoint rules below.
Unknown keys, types, or duplicate rules fail with exit 2. Absent optional keys
are not type-checked. Empty values produce the existing empty finding.
Type failures have code `type`, `key`, `role`, `line`, and `expected` in JSON;
the actual value is never included. No types are guessed from names or examples.

### Optional settings

`devkit check --optional ANALYTICS_KEY,EMAIL_FROM` allows those example keys to
be absent. Names must exist in the example, be unique and case-sensitive, with
no spaces in the comma-separated list. A typo fails with exit 2. Present optional
keys must still be non-empty and unique. `required` in JSON counts only required
keys when this option is used; without it, all example keys remain required.

For scripts and CI integrations, request a JSON report:

```sh
node bin/devkit.js check --format json
```

Stdout contains exactly one JSON object and a trailing newline. No heading or
text summary is mixed in. `--format text` explicitly selects the default report.
All input options can be combined in either order. Example success report:

```json
{
  "schemaVersion": 1,
  "status": "pass",
  "required": 3,
  "issueCount": 0,
  "findings": []
}
```

`required` counts unique non-optional names in the example. `status` is `pass` or `fail`, and
`issueCount` equals the findings array length. A finding has `code` and `role`
(`example` or `env`). Codes are `missing` (with `key`), `empty` (with `key` and
`line`), `duplicate` (with `key` and `lines`), `invalid` (with `line`), or
`no-requirements`. Line numbers start at 1. Values, paths, and source snippets
are excluded. Opt-in policies also add `type`, `unresolved`, or `unexpected`
codes as described above. Consumers should tolerate additive codes and fields.
`schemaVersion` allows consumers to check report compatibility.

Exit codes are unchanged in JSON mode. On argument or file errors (exit 2),
stdout is empty and stderr contains a readable error, not a JSON report. Check
the exit code before attempting to parse stdout. Help remains readable text.

| Code | Meaning |
| --- | --- |
| 0 | No findings, or help requested |
| 1 | Settings findings; inspect the report on stdout |
| 2 | Invalid arguments or unreadable/non-UTF-8 files; error on stderr |

The same command can fail a CI job. Provide files through your own CI setup;
the checker never uploads them. It is a preflight check, not a complete
deployment or security audit.

Quoted values can span physical lines. CRLF is normalized to LF inside values. Comments and assignments inside quotes remain literal content. Findings use the opening declaration line; unterminated quotes consume the remaining input and produce a syntax finding without exposing contents.

With `--references check`, bare `$NAME`, shell substitutions, fallback expressions
such as `${NAME:-default}`, and malformed braced references produce
`unsupported-reference`. Only the owning key and line are reported. Single-quote
literal text or escape a dollar to opt out; ordinary dollar amounts remain literal.
The checker never runs shell expressions or evaluates fallback values.

### Save project rules in a policy file

Run `devkit check --config devkit-policy.json` with this versioned JSON file:

```json
{
  "schemaVersion": 1,
  "optional": ["ANALYTICS_KEY"],
  "types": { "PORT": "port", "DEBUG": "boolean" },
  "references": "check",
  "extras": "error"
}
```

All fields except `schemaVersion` are optional. Optional/type names must exist in
`.env.example`. Unknown fields, invalid types, malformed JSON, or unreadable files
fail with exit 2 without echoing file contents. Files must be UTF-8 (BOM accepted).
Only an explicitly supplied config is loaded; no parent-directory search occurs.
CLI rules override the corresponding entire config rule regardless of argument
order. For example, `--extras allow` overrides the file's extra-key restriction.
Paths remain CLI options relative to the current working directory. Keep actual
settings and credentials out of the policy; it contains names and rules only.

### Check a piped settings file

Use `--env -` (or `--example -`) to read that input from stdin. For example,
on a POSIX shell: `cat generated.env | node bin/devkit.js check --env -`.
On PowerShell: `Get-Content -Raw generated.env | node bin/devkit.js check --env -`.
This also lets another tool stream generated settings directly into the checker.
Only one settings input may use `-`; both at once fail with exit 2. A real file
named `-` can be selected with `./-`. Interactive terminal input is rejected;
use a pipe or redirection. Input must be UTF-8 and is read into memory, never
written to disk by the checker. Empty stdin is checked as an empty file. Reports
and exit codes are identical to file inputs, and values stay hidden.

### Opt into Node.js production conventions

Use `devkit check --profile node-production`, or add
`"profile": "node-production"` to your policy JSON. This requires `NODE_ENV` to
exist with the exact literal value `production`. If `DEBUG` is present, it must
be exactly `false`. Absent `DEBUG` is allowed by the profile, but your example
file still controls whether it is required. Optional keys cannot waive profile
requirements. Values are never expanded or read from the shell environment.

These are explicit project conventions, not universal rules for every Node.js
library: only opt in if your app treats `DEBUG` as a boolean. The profile does
not inspect application code or guarantee deployment security. Default `none`
preserves local development behavior; `--profile none` overrides a policy file.
Failures use JSON code `profile`, with the owning key, profile name, and line
when present. Existing empty/missing/type checks may also report the same key.
Declare `NODE_ENV` in the example when combining with `--extras error`.

### HTTP endpoint rules

Use `--types API_URL:http-url` or `"types": { "API_URL": "http-url" }` in a
policy file to validate absolute HTTP/HTTPS endpoints. Localhost, IPv6, paths,
queries, and percent-encoded spaces are supported. Relative URLs, other schemes,
whitespace, backslashes, embedded credentials, invalid ports, and `${...}`
interpolation fail. Empty values retain the `empty` finding; absent optional
settings are skipped. Reports include `expected: "http-url"`, never the URL.
This is syntax validation only: no DNS, HTTP requests, or availability checks.
Do not use this type for database connection strings or interpolated endpoints.

### Allowed values for project-specific settings

Policy JSON can declare exact choices, for example:

```json
{ "schemaVersion": 1, "allowed": { "LOG_LEVEL": ["debug", "info", "warn", "error"] } }
```

Each name must exist in the example. Lists must contain unique, non-blank strings;
comparisons are case-sensitive with no trimming or variable expansion. Present
non-empty values outside the list produce `allowed` findings. Missing, empty,
duplicate and type checks still apply; absent optional settings are skipped.
Allowed rules are config-only (no CLI value lists or override); edit the policy
to change them. Reports and errors never echo actual values or allowed choices.
Use these lists for non-secret configuration enums, not credential validation.

### Explain how to fix findings

Add `--explain on` to show a short `Fix:` line after each text finding. In JSON
mode the same guidance appears as a `hint` field on each finding. Codes, counts,
line numbers, schema version, and exit status stay unchanged. Default `off`
preserves the original output shape. Hints contain fixed instructions and never
include setting values, reference targets, or permitted policy choices. They
suggest manual changes; the checker does not edit files. Use finding codes for
automation, since human-readable wording may improve over time.

Reference escapes are interpreted from the original value before double-quoted
backslash decoding. An odd number of backslashes immediately before `$` escapes
it; an even number leaves the reference active. Single-quoted values remain
literal. Trailing comments are never scanned for references.
