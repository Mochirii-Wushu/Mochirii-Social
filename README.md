# Mochirii Social governance seed

History-clean governance proposal for the future canonical
`Mochirii-Wushu/Mochirii-Social` repository.

This tree intentionally contains no runnable application, image, deployment,
provider binding, secret, member data, or production activation. It exists to
establish repository instructions, contribution and security policy,
least-privilege CI, official upstream provenance, clone-local remote safety,
and a machine-checked no-parent bootstrap boundary before the accepted Social
source candidate is introduced in a later reviewed child commit.

## Validate

```sh
npm ci --ignore-scripts
node scripts/configure-remotes.mjs --apply
npm run check
npm run check:remotes
git diff --check
```

The configurator changes only local Git configuration and performs no fetch or
push. Passing validation proves only the governance source. It does not satisfy
the unresolved CODEOWNERS team, private-capable GitHub plan, protected-main,
legal, image, provider, identity, backup/restore, deployment, or live-service
gates.

## Upstream and license

The later application source is derived from the official Pixelfed project at
`https://github.com/pixelfed/pixelfed.git` and remains licensed under GNU
AGPLv3. This governance seed preserves the exact upstream license in `LICENSE`
and the reviewed source identity in
`docs/operations/UPSTREAM-PROVENANCE.md`. A private GitHub repository alone is
not the production Corresponding Source offer required by the release gate.

## Integration

See `docs/operations/REMOTE-BOOTSTRAP.md` and
`docs/operations/github-bootstrap.v1.json`. No commit, push, ruleset, plan,
visibility, package, environment, secret, provider, or production mutation is
authorized by these files.
