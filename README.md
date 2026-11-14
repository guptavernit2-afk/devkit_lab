# devkit-lab

Small, dependency-free command-line tools for everyday development. Data stays
on your machine; the tools do not make network requests.

## Getting started

Requires Node.js 22 or later.

```sh
git clone https://github.com/guptavernit2-afk/devkit_lab.git
cd devkit_lab
npm start -- --help
```

You can also run `node bin/devkit.js` directly. Optionally run `npm link` to
make the `devkit` command available locally. No package installation is required
to run or test the tools.

## Tools

The examples below use the optional `devkit` command. Without `npm link`, replace
`devkit` with `node bin/devkit.js`.

### JSON

```sh
devkit json format '{"ready":true,"items":[1,2]}'
devkit json minify --file data.json
devkit json validate --file package.json
```

Use `--stdin` to read piped JSON. In PowerShell:

```powershell
Get-Content package.json -Raw | node bin/devkit.js json format --stdin
```

In Bash:

```sh
cat package.json | node bin/devkit.js json format --stdin
```

Formatting uses two-space indentation. Minification removes insignificant
whitespace and outputs compact JSON, preserving whitespace inside strings.
Both commands accept a JSON string, `--file <path>`, or `--stdin`, and end their
output with a newline so it works naturally in shell pipelines.
Validation accepts all JSON values,
including `null`, strings, and numbers. These tools use JavaScript's JSON parser:
duplicate keys retain the last value, and large numbers can lose precision when
formatted or minified. Avoid either transformation on documents that require
exact large integer values.

### URL components

```sh
devkit url encode "hello world & friends"
# hello%20world%20%26%20friends
devkit url decode "hello%20world%20%26%20friends"
# hello world & friends
```

Encode individual query values or path segments. Encoding an entire URL also
escapes its separators. A literal `+` stays `+` when decoded; form-urlencoded
input requires different handling. Malformed percent escapes fail with a readable
error. Quote input containing spaces or shell metacharacters.

Use `form-encode` and `form-decode` for individual HTML form values:

```sh
devkit url form-encode "a b+c"
# a+b%2Bc
devkit url form-decode "a+b%2Bc"
# a b+c
```

These commands handle one value, not an entire query string or form body.
They use `+` for spaces, preserve literal plus signs through `%2B`, and reject
malformed percent escapes instead of silently replacing invalid text.

### Unix timestamps

```sh
devkit time from-unix 0
# 1970-01-01T00:00:00.000Z
devkit time to-unix 2024-02-29T00:00:00Z
# 1709164800
devkit time from-unix 1234 --ms
# 1970-01-01T00:00:01.234Z
devkit time to-unix 1970-01-01T00:00:01.234Z --ms
# 1234
```

Seconds are the default; `--ms` selects milliseconds. Input dates must explicitly
use UTC (`Z`) with seconds and an optional one-to-three-digit fraction. Impossible
dates are rejected. Conversion to whole seconds rounds down, including before
1970. Numeric input must be an integer within JavaScript's supported date range.

All commands print results to stdout. Invalid input prints an error to stderr
and exits with status 1. Run `devkit <command> --help` for usage.

## Development

Run `npm test` to execute the test suite. The project uses JavaScript modules
and Node's built-in APIs, with no third-party runtime dependencies.

GitHub Actions runs the suite on Windows and Linux with Node.js 22 and 24.

See [ROADMAP.md](ROADMAP.md) for prioritized next steps.
