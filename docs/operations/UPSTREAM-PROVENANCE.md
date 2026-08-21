# Upstream provenance

- Official project: Pixelfed
- Official source: `https://github.com/pixelfed/pixelfed.git`
- License: GNU Affero General Public License version 3
- Reviewed official `dev` revision:
  `c8bed78bee3d796c5efb57393dafafbba3706f38`
- Reviewed stable release: `v0.12.7`
- Reviewed stable revision:
  `e33026a9e5334d2c124a7321f8b15d4329b8961f`
- Incumbent Website production commit:
  `ef5675575aeea6cb41def256d0a889f60f963ff8`
- Incumbent `services/social` tree:
  `d34a61164a37a5b9c476120b03058e6a9836fc58`
- Last recorded Website deployment image digest:
  `sha256:1fd27c8f76595595912e6f12f1677c7f108aa50f64b38a85089006b47ad395f1`
- First Social-repository cutover commit:
  `c42373b513b61171e8eb5b6800ee4ab4c8c6a23f`
- First Social-repository cutover image digest:
  `sha256:c2101909ae44a0653a742a782edbb3859600e52c4d2987440450fce91bad37aa`

The integration child preserves the incumbent source and its upstream or
third-party notices. Sorted Git-blob SHA-256 manifests identify the exact
incumbent and imported trees and an explicit repository-transition allowlist.
Production never follows a moving upstream branch.

The recorded digest is historical release evidence, not current live-host
proof. Current pre-cutover image identity and the unavailable historical OCI,
configuration, migration, and rollback fields are `UNKNOWN_PRE_CUTOVER`.
Complete immutable provenance begins with the first Social-repository
candidate. Its candidate, deployment, hosted-verification, artifact-hash, and
attestation evidence is sealed in `authority-cutover.v1.json`. That historical
chain does not substitute for a fresh current-host identity readback.
