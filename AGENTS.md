# Mochirii Social repository guidance

This repository is the canonical source and deployment authority for
`social.mochirii.com`. The separately gated production cutover completed on
2026-08-14, and the application remains under `services/social`.

## Required workflow

- Begin with `git status --short --branch` and preserve every existing change.
- Use one focused branch and protected pull request. Never edit `main`
  directly, rewrite the governance-seed ancestry, force-push, or push upstream.
- Run repository commands from the root and application commands from
  `services/social`. Derive checks from the current manifests and workflows.
- Run `npm ci --ignore-scripts`, `npm --prefix services/social ci`,
  `npm run check`, the Composer/PHP checks, container checks where available,
  and `git diff --check` before handoff.

## Cutover and post-cutover boundaries

- Preserve the immutable first-cutover manifests and evidence. New application
  behavior, dependency, migration, generated-asset, route, or runtime-default
  changes require their own focused post-cutover review and release evidence.
- Keep registration closed and ActivityPub federation disabled.
- Preserve the existing database, Redis, storage, media, authentication,
  membership, worker, scheduler, Compose, and recovery behavior.
- Preserve upstream licenses and attribution. Upstream and provider names may
  remain in internal code, dependencies, operator documentation, private
  technical logs, and legally required notices, but not ordinary
  member-facing product copy.
- Production accepts only an exact reviewed immutable image digest tied to one
  full Social commit and the pinned upstream revision.
- The first Social-repository cutover used `migration_approval=NONE`. Any later
  pending migration still stops without its own exact approval and verified
  backup.

## Release and secret boundaries

- The host protocol retains the exact legacy
  `repository=Mochirii-Wushu/Mochirii` sentinel. It is not the canonical source
  owner. New releases also carry `source_repository` and `source_commit`.
- Historical live provenance fields that could not be read before cutover
  remain `UNKNOWN_PRE_CUTOVER`. The completed cutover evidence and current
  live-identity limitation are recorded in
  `docs/operations/AUTHORITY-CUTOVER.md`; do not represent historical workflow
  success as a fresh host readback.
- Never commit runtime `.env` files, OAuth keys, database/media/cache state,
  backups, host addresses, credentials, generated archives, or private
  evidence.
- A source or CI result never authorizes image publication, a provider
  mutation, secret change, production deployment, or rollback. Follow the
  exact gates in `docs/operations/DEPLOYMENT.md`.
- `origin` is the canonical Mochirii repository. `upstream` is the official
  pull-only source remote with an inert push URL.
