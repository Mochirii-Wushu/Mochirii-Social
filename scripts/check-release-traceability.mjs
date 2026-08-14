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
]);

if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log("Release traceability and pre-cutover provenance contract passed.");
