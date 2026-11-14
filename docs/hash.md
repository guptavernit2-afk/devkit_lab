# SHA-256 checksums

```sh
node bin/devkit.js hash "abc"
# ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
node bin/devkit.js hash --file "archive.zip"
```

Use `--stdin` to hash piped bytes. The command reads files and stdin in 64 KiB
chunks and prints only the lowercase hexadecimal digest followed by a newline.
Text arguments are UTF-8; files and stdin retain all bytes, including byte-order
marks and line endings. A shell pipeline may change those bytes before delivery,
so prefer `--file` when checking a downloaded file. Empty input is supported.

Compare against a checksum from a trusted source. A checksum alone does not
prove who produced a file. SHA-256 here is not a password storage scheme.
