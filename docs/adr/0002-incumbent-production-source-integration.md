# ADR 0002: Incumbent production source integration

- Status: Superseded for ownership status by ADR 0003
- Date: 2026-08-13

## Context

The Website repository historically owned the deployed Social application.
The exact recorded deployment source is Website commit
`ef5675575aeea6cb41def256d0a889f60f963ff8`, whose `services/social` tree is
`d34a61164a37a5b9c476120b03058e6a9836fc58`. Copying a newer Website tree or
an unmodified upstream checkout would not preserve incumbent behavior.

## Decision

Import that exact Git tree beneath `services/social` as a child of the reviewed
governance root. Preserve application code, dependencies, generated assets,
migrations, production Compose services, runtime paths, database and Redis
images, workers, scheduler, registration, federation, authentication, media,
backup, and recovery behavior.

Only repository identity, OCI/release source identity, governance,
documentation, workflows, and validation may differ. The sorted SHA-256
manifests and explicit transition allowlist enforce that boundary using Git
blob bytes rather than Windows worktree bytes.

The retained host protocol sentinel
`repository=Mochirii-Wushu/Mochirii` remains unchanged. New release metadata
separately identifies `Mochirii-Wushu/Mochirii-Social` and its exact commit.

## Consequences

- No application upgrade, schema change, or production mutation is part of
  Stage 1.
- Unavailable historical live provenance is recorded as
  `UNKNOWN_PRE_CUTOVER` and is not reconstructed by installing a verifier.
- Complete provenance begins with the first immutable candidate produced from
  this repository.
- Production authority remained with Website until the separately gated Social
  cutover and recovery validation succeeded. ADR 0003 records that completed
  transition without changing this ADR's initial-candidate decision.
