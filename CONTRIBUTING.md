# Contributing to Mochirii Social

## Repository workflow

The sealed bootstrap evidence recorded the live repository as empty before this
seed was prepared. While it remains empty, only an exact, independently
reviewed history-clean governance seed may be first-pushed to `main`, and only
under a separate target-specific authorization. This document is not that
authorization. Once `main` exists:

1. Read `AGENTS.md` and the bootstrap contract.
2. Start from the exact current `main` commit and create one focused branch.
3. Keep the change inside the approved Social ownership boundary.
4. Add tests and contract evidence for every changed behavior.
5. Run the repository checks and inspect the complete diff.
6. Open a pull request to `main` with exact base/head identity, scope, risk,
   validation, release effects, and rollback disposition.
7. Obtain accountable review of the final exact head and use only the normal
   protected merge path.

Do not target Pixelfed's `staging` or `dev` branch from this repository.
Upstream changes are inspected through the pull-only `upstream` remote, pinned
to an exact reviewed revision, and adapted in an isolated Mochirii branch.
Nothing in this policy authorizes a push to upstream.

## CODEOWNERS and plan blocker

No existing Mochirii organization team has been approved for CODEOWNERS, and
no private-capable GitHub plan has been approved. `.github/CODEOWNERS` is
therefore comment-only. Do not invent a team slug, use an organization handle,
or substitute a personal owner. Until both decisions are approved and provider
readback proves enforcement, exact-head human review remains a procedural gate
and the source is not ready for remote bootstrap.

## Security and release boundaries

Report vulnerabilities through the repository's private security-advisory
channel described in `SECURITY.md`, never a public issue or pull request.
Do not submit credentials, member data, databases, runtime environment files,
uploaded media, backups, archives, generated artifacts, local paths, or
provider configuration.

Preserve upstream license and attribution. Application-source changes require
the full Social validation, license/source-offer disposition, immutable image
identity, rollback evidence, and explicit publication/deployment approvals.
Passing review or CI does not publish an image, activate a runtime, change a
provider, or deploy production.
