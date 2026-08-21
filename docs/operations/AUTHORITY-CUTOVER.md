# Social authority cutover

The Social-repository authority cutover completed on 2026-08-14. The sealed
record is [`authority-cutover.v1.json`](authority-cutover.v1.json).

The exact chain was:

- canonical commit
  `c42373b513b61171e8eb5b6800ee4ab4c8c6a23f`;
- `services/social` tree
  `83cd6b9769d065078bdcc7e2fef507c08846baf9`;
- immutable image digest
  `sha256:c2101909ae44a0653a742a782edbb3859600e52c4d2987440450fce91bad37aa`;
- candidate-publication workflow run `31777853084`;
- production-deployment workflow run `31783483134`; and
- hosted-verification workflow run `31783837829`.

The candidate evidence artifact contains the release traceability record and
SPDX SBOM. Their SHA-256 hashes are sealed in the JSON record. GitHub's
attestation API returned one SLSA provenance statement and one SPDX statement
for the exact digest on 2026-08-21. The record deliberately stores predicate
types and subject identity, not expiring signed download URLs.

## Evidence boundary

The successful deployment and hosted-verification runs prove the operations
performed by those workflows at that time. They do not prove that an operator
has not changed the host afterward. The restricted verifier at the cutover
commit did not return the running release commit, image digest, or OCI labels,
so current live identity remains `UNVERIFIED_CURRENT_LIVE` until a reviewed
verifier exposes those non-secret fields and a fresh hosted readback passes.

The same historical workflow also did not test NodeInfo, WebFinger, the
instance actor, or an exact Corresponding Source offer. Read-only public
readback on 2026-08-21 found those federation-identification surfaces still
reachable and found no prominent canonical-source link. Active ActivityPub
configuration was disabled, but the broader public-boundary and network-source
gates are not satisfied. No production change is authorized by this record.

## Ownership result

`Mochirii-Wushu/Mochirii-Social` is the canonical source, build, deployment,
recovery, and upstream-integration owner. The legacy release-metadata sentinel
`repository=Mochirii-Wushu/Mochirii` remains only for compatibility with the
root-owned host parser. It does not transfer source ownership back to Website.

The imported Website manifests remain immutable evidence of the initial
application tree. Future reviewed Social changes are compared through normal
Git history and pull-request validation; the one-time equivalence checker
continues to validate the exact cutover commit instead of freezing current
`services/social` forever.
