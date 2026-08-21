# ADR 0003: Social authority cutover completed

- Status: Accepted
- Date: 2026-08-21
- Cutover date: 2026-08-14

## Context

ADR 0002 established the exact source-equivalent candidate and left production
authority with Website until a separately gated cutover succeeded. The
candidate publisher, production deployer, and hosted verifier subsequently
completed successfully for canonical Social commit
`c42373b513b61171e8eb5b6800ee4ab4c8c6a23f` and immutable image digest
`sha256:c2101909ae44a0653a742a782edbb3859600e52c4d2987440450fce91bad37aa`.

The repository's documentation and one-time equivalence checker were not
advanced after that event. They still described a pre-cutover candidate and
required the current application index to remain byte-identical to the import,
which would prevent ordinary reviewed maintenance in the canonical owner.

## Decision

Record the completed cutover in an immutable structured evidence file. Retain
the original pre-cutover and source-equivalence records without rewriting
their historical facts. Validate the imported manifest against the exact
cutover commit and tree, not against future Social heads.

`Mochirii-Wushu/Mochirii-Social` now owns the application source, immutable
image, release controls, recovery controls, and upstream integration. Website
retains historical commits and shared integration clients only.

## Consequences

- Post-cutover application changes require focused pull requests, exact-head
  validation, and the existing production approval gates.
- The completed cutover does not authorize a new image publication,
  deployment, migration, provider change, restart, or public-copy change.
- Historical workflow success is not represented as current live-host proof.
- The network-source license gate and passive federation-identification gap
  remain separately blocked until their implementation and approval gates pass.
