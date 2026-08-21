# Mochirii Social

Canonical source, immutable image, deployment, validation, and recovery
repository for `social.mochirii.com`. The authority cutover completed on
2026-08-14; its exact evidence and current verification limits are recorded in
[`docs/operations/AUTHORITY-CUTOVER.md`](docs/operations/AUTHORITY-CUTOVER.md).

The application stays at `services/social` and was imported from Website commit
`ef5675575aeea6cb41def256d0a889f60f963ff8`. The imported tree preserves the
incumbent application, dependencies, generated assets, migrations, production
Compose template, operations scripts, and upstream revision. The sealed
equivalence manifests continue to prove that first cutover; subsequent source
changes follow ordinary reviewed Social history and release gates.

## Fixed posture

- closed registration;
- existing Mochirii identity and membership flow;
- ActivityPub federation disabled;
- existing database, Redis, workers, scheduler, and object-storage behavior;
- exact-digest production images only;
- no workstation runtime dependency.

## Validate

```sh
npm ci --ignore-scripts
npm --prefix services/social ci
npm run check
composer install --working-dir=services/social --no-interaction --prefer-dist --no-progress
php services/social/artisan test services/social/tests/Unit/AvatarUploadPolicyTest.php
git diff --check
```

The image workflow additionally builds the exact application context,
validates clean-database migrations, verifies OCI labels, produces an SPDX
SBOM, creates GitHub attestations, and records the immutable registry digest.
Candidate publication and production deployment are separate manual gates.

## Operations

- [Source equivalence](docs/operations/SOURCE-EQUIVALENCE.md)
- [Authority cutover](docs/operations/AUTHORITY-CUTOVER.md)
- [Deployment and rollback](docs/operations/DEPLOYMENT.md)
- [Release traceability](docs/operations/RELEASE-TRACEABILITY.md)
- [Upstream provenance](docs/operations/UPSTREAM-PROVENANCE.md)
- [Hosted runtime](services/social/docs/online-hosted-runtime.md)
- [Backup and recovery](services/social/docs/online-backup-recovery.md)

## License

The application source remains under GNU AGPLv3, with required upstream and
third-party notices preserved. Operational secrets, member data, databases,
media, and recovery material never belong in Git.
