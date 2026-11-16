# Using the checker in CI

The repository runs [setup-demo.yml](../.github/workflows/setup-demo.yml) on push
and pull requests. It needs read-only repository permissions and no secrets or
package downloads beyond the Node runtime. It checks our dummy corrected file
passes and our broken file fails with exactly the intended findings.

Run the same integration example locally:

```sh
npm run test:demo
```

The demonstration failure is asserted inside the script, so the CI job itself
passes only when both passing and failing behavior are correct.

## Add a real preflight step

In a checkout containing devkit-lab and your project's example and candidate
settings files, a normal workflow step can run:

```yaml
- name: Check candidate settings
  run: node bin/devkit.js check --example path/to/.env.example --env path/to/candidate.env --format json --types DEBUG:boolean,PORT:port --references check --extras error
```

Adjust paths and type rules to your project. If devkit-lab is checked out into a
subdirectory, update the script path too. This is a CLI example, not a published
GitHub Action or npm package. Do not enable continue-on-error for a deployment
gate: exit 1 means findings and exit 2 means an invalid check. Both must block it.

Provide candidate files through your existing trusted deployment setup. Do not
commit real `.env` files, echo their contents into logs, or pass secrets in command
arguments. Do not expose deployment secrets to untrusted pull requests; use
dummy fixture checks for PRs and trusted, protected jobs for private inputs.
The checker reports names and lines only; reports still contain configuration
metadata, so review artifact access before storing them.

All example keys are required unless listed with `--optional`. Use JSON output
for tooling. For exit 2, stdout is empty and stderr is readable text. A passing
check proves structural consistency and selected policies, not credential
validity, remote connectivity, or deployment readiness.
