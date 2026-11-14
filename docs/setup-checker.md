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

V1 supports single-line declarations:

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
- Multiline quoted values, backtick quoting, and shell commands are unsupported.
  Files are never executed. Variable references such as `${OTHER_KEY}` remain
  literal text; V1 does not resolve references or verify whether they exist.

This is a documented subset rather than a replacement for every dotenv loader.
It does not validate types, URLs, production debug policy, optional keys, or
credential validity. Use an explicit example file listing only required keys.

## CI exit codes

| Code | Meaning |
| --- | --- |
| 0 | No findings, or help requested |
| 1 | Settings findings; inspect the report on stdout |
| 2 | Invalid arguments or unreadable/non-UTF-8 files; error on stderr |

The same command can fail a CI job. Provide files through your own CI setup;
the checker never uploads them. It is a preflight check, not a complete
deployment or security audit.
