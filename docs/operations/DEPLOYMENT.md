# Deployment and rollback

No repository checkout deploys automatically. Candidate publication and
production deployment are separate manual workflows on protected `main`.

## Pre-cutover historical record

The existing restricted host verifier cannot expose the historical live image
digest, OCI labels, sanitized configuration hash, complete migration
inventory, or externally readable rollback digest. These fields are:

`UNKNOWN_PRE_CUTOVER`

Do not install a verifier solely to reconstruct them. The last recorded
Website deployment commit and image digest remain historical evidence, not a
claim about current live identity.

## Completed first-cutover evidence

The first deployment from this repository completed on 2026-08-14. Its exact
commit, application tree, image digest, candidate artifact hashes,
attestations, deployment run, and hosted-verification run are sealed in
`authority-cutover.v1.json`. That release:

1. passed the existing restricted online-hosting verifier;
2. required source-equivalence validation and green exact-head CI;
3. published one immutable candidate tied to the reviewed Social commit;
4. verified its digest, OCI source/revision/upstream/version labels, SBOM, and
   GitHub provenance;
5. required the candidate pending-migration result to be empty; and
6. used the existing root-owned host deployer and rollback metadata.

The first cutover accepted only `migration_approval=NONE`. Historical workflow
success is not current host identity: the restricted verifier at that commit
did not return the running commit, digest, or OCI labels. A later release must
first add and validate that non-secret readback rather than infer current state
from the 2026-08-14 run. Until then, the status is
`UNVERIFIED_CURRENT_LIVE`.

## Successor release gate

Before another production deployment:

1. obtain the exact source, publication, production, migration, and any
   provider approvals required for that release;
2. pass exact-head source, application, image, source-package, recovery, and
   security validation;
3. read the current host commit, image digest, labels, migration inventory, and
   rollback reference through the reviewed restricted verifier;
4. bind the candidate image to its exact public Corresponding Source package
   and pass the counsel-reviewed network-source gate;
5. preserve closed registration and fail-closed federation/public-discovery
   posture; and
6. record the predecessor digest and complete successor evidence without
   rewriting the first-cutover record.

Any pending migration still stops unless a separate verified backup and exact
migration approval exist.

## Release protocol

The no-secret release bundle contains only the byte-equivalent production
Compose template and `release.meta`. The metadata retains the exact legacy
host-parser sentinel:

```text
repository=Mochirii-Wushu/Mochirii
```

It also records:

```text
source_repository=Mochirii-Wushu/Mochirii-Social
source_commit=<full Social commit>
```

The sentinel is compatibility metadata, not the canonical source owner.

## Verification and rollback

After deployment, verify HTTPS, the exact commit and digest, OCI labels, DB,
Redis, Horizon, scheduler, unchanged media paths, Spaces round-trip,
authentication, closed registration, unchanged federation, existing-user
continuity, and Mochirii-only member-facing branding.

If deployment fails before the switch, leave the incumbent untouched. If it
fails after a no-migration switch, let the root-owned deployer restore its
previous release, then re-run the hosted verifier and continuity checks.
Never proceed to Forums after a failed Social cutover.

Runtime secrets stay only in protected GitHub environments and root-owned host
files. They never belong in a release bundle, Git, logs, or artifacts.
