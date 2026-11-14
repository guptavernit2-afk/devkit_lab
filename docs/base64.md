# Base64 text conversion

```sh
node bin/devkit.js base64 encode "hello"
# aGVsbG8=
node bin/devkit.js base64 decode "aGVsbG8="
# hello
```

Use `--stdin` in place of text to read a pipeline. Input is read exactly:
newlines are encoded, and Base64 input must not include whitespace. Standard
Base64 padding is required when needed; URL-safe Base64 is not accepted.
Decoding rejects invalid UTF-8 instead of corrupting binary content. Empty text
is supported. CLI results include one additional trailing newline.

This is a text utility, not a binary file converter. Base64 is an encoding, not
encryption; it does not protect credentials or other sensitive content.
