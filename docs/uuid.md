# Random UUID generation

```sh
node bin/devkit.js uuid
node bin/devkit.js uuid --count 5
```

Generates version 4 UUIDs using Node's cryptographic random UUID API. By default
the command prints one lowercase, hyphenated UUID. `--count` accepts a whole
decimal number from 1 to 1000 and prints one UUID per line, with a final newline.
Counts with signs, leading zeros, fractions, or exponent notation are rejected.

Use these identifiers in test fixtures, seed data, or development requests.
The batch limit prevents accidental oversized output. UUIDs are identifiers;
use a dedicated secret generation workflow for passwords or API credentials.
