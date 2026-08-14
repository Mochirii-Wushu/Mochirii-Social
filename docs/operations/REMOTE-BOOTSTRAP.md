# Canonical remote bootstrap and verification

These scripts configure and verify only clone-local Git settings. They never
fetch, push, create a branch, alter GitHub, or change a provider.

## Required topology

- `origin` fetch/effective push:
  `https://github.com/Mochirii-Wushu/Mochirii-Social.git`
- `upstream` fetch: `https://github.com/pixelfed/pixelfed.git`
- `upstream` sole push URL: `disabled://upstream-push`
- `upstream` sole fetch refspec:
  `+refs/heads/dev:refs/remotes/upstream/dev`
- `upstream` automatic tags: disabled
- push default: `origin`
- pull policy: fast-forward only
- branch tracking of `upstream`: forbidden
- URL rewrites affecting protected remote URLs: forbidden

## Configure an intended fresh clone

Confirm the clone's `origin` is already canonical, then run:

```sh
node scripts/configure-remotes.mjs --apply
node scripts/verify-remotes.mjs
```

The configurator is idempotent, refuses unexpected remotes or settings, and
restores the prior local Git config if post-change verification fails. The
verifier prints no configured values. The pinned checkout Action initializes
HTTPS `origin` without the optional `.git` suffix; the configurator accepts
only that exact equivalent spelling and normalizes it to the canonical URL
before verification.

The optional `--require-reachable` verifier flag performs a read-only
`ls-remote` of official `dev`. Adding `--require-pinned-head` additionally
requires the exact reviewed upstream revision recorded in provenance. Those
network checks are deliberately excluded from ordinary offline validation.
The optional `--prove-upstream-push-disabled` flag performs only a dry-run to
the inert transport and requires failure before network authentication.

A clone-local sentinel is defense in depth, not account-level authorization
evidence. No script here grants permission to push either remote.
