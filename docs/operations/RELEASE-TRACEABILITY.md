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
Unavailable pre-cutover fields are `UNKNOWN_PRE_CUTOVER`. Complete provenance
begins with the first candidate built from this repository. The production
workflow verifies the immutable commit tag and all required labels before
sending a release bundle.
