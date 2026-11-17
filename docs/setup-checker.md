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
  literal text; V1 does not resolve references or verify whether they exist.

This is a documented subset rather than a replacement for every dotenv loader.
By default it checks presence, emptiness, duplicates, and syntax. Optional
settings, boolean/port types, direct references, and unexpected keys can be
checked with the policies below. URLs, production debug rules, recursive
references, and credential validity are not validated.

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
presence check: recursive expansion, `$NAME`, and `${NAME:-fallback}`
syntax are not analyzed. Type rules check literal values, not expanded results.

Reference checks also detect circular dependencies, including self references.
Each participating key receives a `cycle` finding with its declaration line;
values and dependency paths are not printed. A key merely pointing into a cycle
is not itself reported as a cycle member. Values are never expanded.

### Explicit types

`devkit check --types DEBUG:boolean,PORT:port` validates selected example keys.
Boolean values must be exactly `true` or `false`; ports must be decimal integers
from 1 to 65535 without signs, leading zeros, spaces inside quotes, or exponents.
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
