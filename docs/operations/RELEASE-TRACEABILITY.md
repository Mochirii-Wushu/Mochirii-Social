# Release traceability

A new Social release is one exact chain:

1. a full commit in `Mochirii-Wushu/Mochirii-Social`;
2. the upstream revision in `UPSTREAM_REVISION`;
3. the application version in `services/social/config/pixelfed.php`;
4. the OCI-labelled image built from `services/social`;
5. the immutable full-commit registry tag and resolved digest;
6. the SPDX SBOM and GitHub build/SBOM attestations; and
7. host metadata containing the legacy sentinel plus `source_repository` and
   `source_commit`.

The image remains in the existing package:
`ghcr.io/mochirii-wushu/mochirii-pixelfed-ops`.

The historical Website deploy record does not establish current live identity.
Unavailable pre-cutover fields remain `UNKNOWN_PRE_CUTOVER` in the sealed v1
record. Complete provenance began with the first candidate built from this
repository.

[`authority-cutover.v1.json`](authority-cutover.v1.json) records that first
candidate, its image digest, evidence-artifact hashes, attestation predicate
types, production deployment, and hosted-verification runs. Those historical
runs do not establish current live identity because the restricted verifier at
that commit did not return the running commit, digest, or OCI labels. Current
live identity remains explicitly unverified until a reviewed verifier and
fresh readback provide it.

The production workflow verifies the immutable commit tag and all required
labels before sending a release bundle. Every later release must preserve the
same exact commit-to-image chain and record its successor relationship without
rewriting the first-cutover evidence.
