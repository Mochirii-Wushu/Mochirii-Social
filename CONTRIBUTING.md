# Contributing to Mochirii Social

## Repository workflow

1. Read `AGENTS.md` and the applicable operations contract.
2. Start from the exact current `main` commit and create one focused branch.
3. Keep application work under `services/social` and repository controls at
   the root.
4. Add tests and contract evidence for every changed behavior.
5. Run the repository, application, PHP, and container checks that apply.
6. Open a protected pull request to `main` with exact base/head identity,
   scope, risk, validation, release effects, and rollback disposition.
7. Obtain accountable review of the final exact head and use only the normal
   protected merge path.

Do not target an upstream development branch from this repository. Inspect
upstream through the pull-only `upstream` remote, pin an exact reviewed
revision, and adapt it only under a separately approved upgrade. Nothing here
authorizes a push upstream.

## Security and release boundaries

Report vulnerabilities through the private-advisory channel in `SECURITY.md`,
never a public issue or pull request. Do not submit credentials, member data,
databases, runtime environment files, uploaded media, backups, generated
archives, local paths, or provider configuration.

Preserve upstream license and attribution. Application changes require source
equivalence disposition, exact image identity, rollback evidence, and explicit
publication/deployment approvals. Passing review or CI does not publish an
image, activate a runtime, change a provider, or deploy production.
