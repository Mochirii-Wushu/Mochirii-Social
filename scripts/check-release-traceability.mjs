import { readFileSync } from "node:fs";

const failures = [];
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");
function requireText(file, snippets) {
  const text = read(file);
  for (const snippet of snippets) {
    if (!text.includes(snippet)) failures.push(`${file} must include: ${snippet}`);
  }
}

const trace = JSON.parse(read("docs/operations/release-traceability.v1.json"));
const authority = JSON.parse(read("docs/operations/authority-cutover.v1.json"));
if (
  trace.schema_version !== 1 ||
  trace.repository !== "Mochirii-Wushu/Mochirii-Social" ||
  trace.registry_image !==
    "ghcr.io/mochirii-wushu/mochirii-pixelfed-ops" ||
  trace.upstream_revision !== read("UPSTREAM_REVISION").trim() ||
  trace.application_version !== "0.12.7"
) {
  failures.push("Release traceability identity is invalid.");
}
if (
  trace.incumbent_record?.website_commit !==
    "ef5675575aeea6cb41def256d0a889f60f963ff8" ||
  trace.incumbent_record?.social_tree !==
    "d34a61164a37a5b9c476120b03058e6a9836fc58"
) {
  failures.push("Incumbent source identity is not recorded exactly.");
}
const unknownFields = [
  "image_digest",
  "oci_labels",
  "sanitized_configuration_hash",
  "complete_migration_inventory",
  "rollback_digest",
];
for (const field of unknownFields) {
  if (trace.live_pre_cutover?.[field] !== "UNKNOWN_PRE_CUTOVER") {
    failures.push(`Historical field must remain UNKNOWN_PRE_CUTOVER: ${field}`);
  }
}
for (const field of [
  "repository_commit",
  "image_digest",
  "sbom_attestation",
  "build_provenance_attestation",
]) {
  if (trace.candidate?.[field] !== null) {
    failures.push(`Unpublished candidate field must remain null: ${field}`);
  }
}

const cutoverDigest =
  "sha256:c2101909ae44a0653a742a782edbb3859600e52c4d2987440450fce91bad37aa";
if (
  authority.schema_version !== 1 ||
  authority.canonical_repository !== "Mochirii-Wushu/Mochirii-Social" ||
  authority.registry_image !== trace.registry_image ||
  authority.cutover?.repository_commit !==
    "c42373b513b61171e8eb5b6800ee4ab4c8c6a23f" ||
  authority.cutover?.application_tree !==
    "83cd6b9769d065078bdcc7e2fef507c08846baf9" ||
  authority.cutover?.upstream_revision !== trace.upstream_revision ||
  authority.cutover?.application_version !== trace.application_version ||
  authority.cutover?.image_digest !== cutoverDigest
) {
  failures.push("Completed authority-cutover identity is invalid.");
}
if (
  authority.candidate_publication?.workflow_run_id !== 31777853084 ||
  authority.candidate_publication?.evidence_artifact?.id !== 9210756860 ||
  authority.candidate_publication?.evidence_artifact?.traceability_sha256 !==
    "bb26736bb9d84c74cf578e1cf4ae8e97b145a6623c884ae96247af8b017a827f" ||
  authority.candidate_publication?.evidence_artifact?.sbom_sha256 !==
    "7a2a6892a226ab9dc1c46cfb640594376bc94ef2322757eaa3ef2397f9a53176" ||
  authority.production_deployment?.workflow_run_id !== 31783483134 ||
  authority.production_deployment?.conclusion !== "success" ||
  authority.hosted_verification?.workflow_run_id !== 31783837829 ||
  authority.hosted_verification?.conclusion !== "success"
) {
  failures.push("Completed authority-cutover workflow evidence is invalid.");
}
const attestations = authority.candidate_publication?.attestations ?? [];
const predicateTypes = attestations
  .map((attestation) => attestation.predicate_type)
  .sort();
if (
  JSON.stringify(predicateTypes) !==
    JSON.stringify([
      "https://slsa.dev/provenance/v1",
      "https://spdx.dev/Document/v2.3",
    ].sort()) ||
  attestations.some(
    (attestation) => attestation.subject_digest !== cutoverDigest,
  )
) {
  failures.push("Completed authority-cutover attestations are invalid.");
}
if (
  authority.current_live_identity?.status !== "UNVERIFIED_CURRENT_LIVE" ||
  authority.network_source_gate?.status !== "BLOCKED_APPROVAL"
) {
  failures.push(
    "Unresolved live-identity and network-source gates must remain explicit.",
  );
}

requireText("services/social/Dockerfile", [
  'org.opencontainers.image.source="https://github.com/Mochirii-Wushu/Mochirii-Social"',
]);
requireText("services/social/scripts/build-production-image.sh", [
  "org.opencontainers.image.source",
  "org.opencontainers.image.revision",
  "org.opencontainers.image.version",
  "org.opencontainers.image.licenses",
  "com.mochirii.social.upstream.revision",
]);
requireText("scripts/check-image-labels.sh", [
  "org.opencontainers.image.source",
  "org.opencontainers.image.revision",
  "org.opencontainers.image.version",
  "org.opencontainers.image.licenses",
  "com.mochirii.social.upstream.revision",
]);
requireText(".github/workflows/validate-social.yml", [
  "Publish one immutable candidate",
  "Generate production image SBOM",
  "Attest production image provenance",
  "Attest production image SBOM",
]);
requireText(".github/workflows/deploy-social-production.yml", [
  "repository=Mochirii-Wushu/Mochirii",
  "source_repository=Mochirii-Wushu/Mochirii-Social",
  "source_commit=",
  "migration_approval",
]);
requireText("docs/operations/DEPLOYMENT.md", [
  "UNKNOWN_PRE_CUTOVER",
  "migration_approval=NONE",
  "repository=Mochirii-Wushu/Mochirii",
  "source_repository=Mochirii-Wushu/Mochirii-Social",
  "UNVERIFIED_CURRENT_LIVE",
  "authority-cutover.v1.json",
]);
requireText("docs/operations/AUTHORITY-CUTOVER.md", [
  "c42373b513b61171e8eb5b6800ee4ab4c8c6a23f",
  cutoverDigest,
  "UNVERIFIED_CURRENT_LIVE",
  "No production change is authorized by this record.",
]);

if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log("Release traceability and pre-cutover provenance contract passed.");
