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

## Required first-cutover evidence

Before deploying from this repository:

1. run the existing restricted online-hosting verifier;
2. create a fresh encrypted application-level backup and pass isolated restore
   validation through the Social recovery workflow;
3. require source-equivalence validation and green exact-head CI;
4. publish one immutable candidate tied to the reviewed Social commit;
5. verify its digest, OCI source/revision/upstream/version labels, SBOM, and
   GitHub provenance;
6. require the candidate pending-migration result to be empty; and
7. let the existing root-owned host deployer confirm that current and rollback
   release metadata exist.

The first cutover accepts only `migration_approval=NONE`. Any pending migration
must stop before application containers are replaced.

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
