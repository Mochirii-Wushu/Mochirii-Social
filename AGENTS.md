# Mochirii Social repository guidance

This repository is the canonical source and deployment authority for
`social.mochirii.com` after the separately gated production cutover. The
application remains under `services/social` for the first authority transfer.

## Required workflow

- Begin with `git status --short --branch` and preserve every existing change.
- Use one focused branch and protected pull request. Never edit `main`
  directly, rewrite the governance-seed ancestry, force-push, or push upstream.
- Run repository commands from the root and application commands from
  `services/social`. Derive checks from the current manifests and workflows.
- Run `npm ci --ignore-scripts`, `npm --prefix services/social ci`,
  `npm run check`, the Composer/PHP checks, container checks where available,
  and `git diff --check` before handoff.

## Locked cutover boundaries

- Preserve the exact incumbent application behavior. This repository move is
  not an application upgrade, data migration, infrastructure migration, or
  feature change.
- Keep registration closed and ActivityPub federation disabled.
- Preserve the existing database, Redis, storage, media, authentication,
  membership, worker, scheduler, Compose, and recovery behavior.
- Preserve upstream licenses and attribution. Upstream and provider names may
  remain in internal code, dependencies, operator documentation, private
  technical logs, and legally required notices, but not ordinary
  member-facing product copy.
- Production accepts only an exact reviewed immutable image digest tied to one
  full Social commit and the pinned upstream revision.
- The first Social-repository cutover uses `migration_approval=NONE`. Any
  pending migration stops before the runtime switch.

## Release and secret boundaries

- The host protocol retains the exact legacy
  `repository=Mochirii-Wushu/Mochirii` sentinel. It is not the canonical source
  owner. New releases also carry `source_repository` and `source_commit`.
- Historical live provenance fields that cannot be read through the existing
  restricted host boundary are `UNKNOWN_PRE_CUTOVER`. Do not install a new
  verifier solely to reconstruct them.
- Never commit runtime `.env` files, OAuth keys, database/media/cache state,
  backups, host addresses, credentials, generated archives, or private
  evidence.
- A source or CI result never authorizes image publication, a provider
  mutation, secret change, production deployment, or rollback. Follow the
  exact gates in `docs/operations/DEPLOYMENT.md`.
- `origin` is the canonical Mochirii repository. `upstream` is the official
  pull-only source remote with an inert push URL.
