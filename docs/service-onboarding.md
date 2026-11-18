# Walk through a service setup check

This dummy Node.js service configuration demonstrates the checker; it does not
start an application or connect to a service. All values are invented.

From the repository root, inspect a deliberately broken deployment candidate:

```sh
node bin/devkit.js check --example examples/service/.env.example --env examples/service/broken.env --config examples/service/policy.json --explain on
```

Exit code 1 is expected. Six findings identify the changes needed:

| Setting | Problem | Correction in the ready fixture |
| --- | --- | --- |
| PORT | Zero is outside the allowed port range | 3000 |
| API_URL | Relative path instead of an HTTP endpoint | An absolute URL on example.test |
| LOG_LEVEL | A value outside the project's allowed list | info |
| WORKER_NAME | Reference to an undefined setting | Reference NODE_ENV |
| NODE_ENV | Development mode under the production profile | production |
| DEBUG | Enabled under the production profile | false |

Run the same command with `examples/service/ready.env` to get exit 0. The
contract has seven required keys and one optional key, ANALYTICS_KEY. BANNER
demonstrates a multiline literal. Reference checks verify dependencies without
expanding them; the checker does not generate WORKER_NAME for your application.
The sample assumes an app that treats DEBUG as a boolean.

Add `--format json` for a structured report with fix hints. A pipeline can use
`--env -` instead of a filename:

```powershell
Get-Content -Raw examples/service/ready.env | node bin/devkit.js check --example examples/service/.env.example --env - --config examples/service/policy.json --format json --explain on
```

On a POSIX shell, replace `Get-Content -Raw` with `cat`.

Run the complete regression demonstration:

```sh
npm run test:service
```

It asserts all six findings, passing corrected settings, identical file/stdin
reports, hidden dummy values, and unchanged input files. `npm test` also runs it
from outside the repository directory on the existing Windows/Linux CI matrix.
Only the deliberately broken *sample* has its failure asserted this way. In a
real deployment gate, use the checker command directly and block on any nonzero
exit code. Keep your actual environment files private and adapt the policy to
your app's contract; a passing report does not prove credentials or connectivity.
