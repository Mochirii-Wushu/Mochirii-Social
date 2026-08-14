## Summary

-

## Scope

- [ ] Governance or documentation only
- [ ] Application source or member-facing behavior
- [ ] Dependency or generated asset update
- [ ] Container, runtime, backup, or recovery contract

## Validation

- [ ] Exact base and head commits recorded
- [ ] `npm ci --ignore-scripts`
- [ ] `npm run check`
- [ ] `npm run check:remotes`
- [ ] Applicable full Social checks pass
- [ ] `git diff --check`

## Release boundaries

- [ ] No secret, credential, private evidence, runtime data, or workstation path is tracked
- [ ] Registration remains closed and ActivityPub remains disabled
- [ ] CODEOWNERS identity and GitHub plan blockers are not represented as satisfied
- [ ] Image publication, deployment, migration, recovery, and provider effects are identified
- [ ] AGPL Corresponding Source and public-attribution gates are explicitly addressed
- [ ] Rollback and predecessor/successor artifact identity are recorded when applicable
