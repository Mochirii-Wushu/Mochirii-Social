import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const repositoryRoot = process.cwd();
const expectedPaths = [
  ".env.example",
  ".gitattributes",
  ".github/CODEOWNERS",
  ".github/pull_request_template.md",
  ".github/workflows/validate-social.yml",
  ".gitignore",
  ".node-version",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "docs/adr/0001-history-clean-governance-bootstrap.md",
  "docs/operations/REMOTE-BOOTSTRAP.md",
  "docs/operations/UPSTREAM-PROVENANCE.md",
  "docs/operations/github-bootstrap.v1.json",
  "package-lock.json",
  "package.json",
  "scripts/check-governance-seed.mjs",
  "scripts/check-history-clean.mjs",
  "scripts/configure-remotes.mjs",
  "scripts/remote-policy.mjs",
  "scripts/test-history-clean.mjs",
  "scripts/test-remotes.mjs",
  "scripts/verify-remotes.mjs",
].sort();

function git(args) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`Git inventory command failed safely: git ${args[0]}`);
  }
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function valueAt(object, dottedPath) {
  return dottedPath
    .split(".")
    .reduce((value, key) => value?.[key], object);
}

const inventory = git([
  "ls-files",
  "--cached",
  "--others",
  "--exclude-standard",
  "-z",
])
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((path) => path.replaceAll("\\", "/"))
  .sort();

assert(
  JSON.stringify(inventory) === JSON.stringify(expectedPaths),
  "Governance seed inventory differs from the exact allowlist.",
);

const forbiddenPath =
  /(^|\/)(?:credentials?|secrets?|storage|vendor|node_modules)(\/|$)|\.(?:age|db|dump|key|p12|pfx|pem|sqlite(?:\d+)?|tar(?:\.gz)?)$/iu;
const allowedEnvironmentFiles = new Set([".env.example"]);
const contentChecks = [
  {
    name: "private key",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
  },
  {
    name: "GitHub token",
    pattern: /github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/u,
  },
  { name: "cloud access key", pattern: /AKIA[0-9A-Z]{16}/u },
  {
    name: "collaboration token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/u,
  },
  { name: "live payment key", pattern: /sk_live_[A-Za-z0-9]{16,}/u },
  {
    name: "local credential boundary",
    pattern: new RegExp("Mochi" + " Creds", "u"),
  },
  {
    name: "local workstation path",
    pattern: new RegExp("[A-Za-z]:" + "\\\\" + "Github Repo", "u"),
  },
];
const decoder = new TextDecoder("utf-8", { fatal: true });

for (const path of inventory) {
  const base = basename(path);
  if (
    (base === ".env" || base.startsWith(".env.")) &&
    !allowedEnvironmentFiles.has(path)
  ) {
    throw new Error(`Unexpected environment file: ${path}`);
  }
  if (forbiddenPath.test(path)) {
    throw new Error(`Forbidden governance-seed path: ${path}`);
  }

  const absolutePath = join(repositoryRoot, ...path.split("/"));
  const stat = lstatSync(absolutePath);
  assert(stat.isFile(), `Inventory entry is not a regular file: ${path}`);
  assert(!stat.isSymbolicLink(), `Symbolic links are forbidden: ${path}`);
  assert(stat.size <= 1024 * 1024, `File exceeds the 1 MiB seed limit: ${path}`);

  const bytes = readFileSync(absolutePath);
  assert(!bytes.includes(0), `Null-containing files are forbidden: ${path}`);
  const text = decoder.decode(bytes);
  assert(!text.startsWith("\uFEFF"), `UTF-8 BOM is forbidden: ${path}`);
  assert(!text.includes("\r"), `Only LF line endings are allowed: ${path}`);
  assert(text.endsWith("\n"), `File must end with one LF: ${path}`);
  assert(!text.endsWith("\n\n"), `File must not end with a blank line: ${path}`);
  for (const [index, line] of text.split("\n").entries()) {
    assert(!/[ \t]+$/u.test(line), `Trailing whitespace at ${path}:${index + 1}`);
  }
  for (const check of contentChecks) {
    assert(!check.pattern.test(text), `${check.name} marker in ${path}`);
  }
}

const licenseBytes = readFileSync(join(repositoryRoot, "LICENSE"));
assert(
  licenseBytes.length === 34520 &&
    createHash("sha256").update(licenseBytes).digest("hex") ===
      "76a97c878c9c7a8321bb395c2b44d3fe2f8d81314d219b20138ed0e2dddd5182",
  "LICENSE must exactly match the accepted Social AGPLv3 license bytes.",
);

const codeowners = readFileSync(
  join(repositoryRoot, ".github", "CODEOWNERS"),
  "utf8",
);
assert(
  codeowners
    .split("\n")
    .filter((line) => line.trim())
    .every((line) => line.startsWith("#")),
  "CODEOWNERS must remain comment-only until a real team is approved.",
);
assert(
  !/(^|\s)@[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?(?:\s|$)/mu.test(codeowners),
  "CODEOWNERS must not contain a user, organization, or team placeholder.",
);

const contributing = readFileSync(
  join(repositoryRoot, "CONTRIBUTING.md"),
  "utf8",
);
for (const required of [
  "pull request to `main`",
  "Do not target Pixelfed's `staging` or `dev` branch",
  "Nothing in this policy authorizes a push to upstream",
  "No existing Mochirii organization team has been approved",
  "no private-capable GitHub plan has been approved",
]) {
  assert(
    contributing.includes(required),
    "CONTRIBUTING.md is missing a required Mochirii governance statement.",
  );
}

const provenance = readFileSync(
  join(repositoryRoot, "docs", "operations", "UPSTREAM-PROVENANCE.md"),
  "utf8",
);
for (const required of [
  "https://github.com/pixelfed/pixelfed.git",
  "GNU Affero General Public License version 3",
  "c8bed78bee3d796c5efb57393dafafbba3706f38",
  "7a12912290a07cae2fa8098e3e04e40c8c254317",
]) {
  assert(
    provenance.includes(required),
    "Upstream provenance is incomplete.",
  );
}

const manifest = JSON.parse(
  readFileSync(
    join(repositoryRoot, "docs", "operations", "github-bootstrap.v1.json"),
    "utf8",
  ),
);
assert(manifest.schema_version === 1, "Bootstrap schema version changed.");
assert(
  manifest.status === "blocked_source_and_approval",
  "Bootstrap status must remain blocked.",
);
assert(
  manifest.scope.repository === "Mochirii-Wushu/Mochirii-Social" &&
    manifest.scope.intended_visibility === "private" &&
    manifest.scope.default_branch === "main",
  "Bootstrap scope changed.",
);
assert(
  manifest.accepted_source.runtime_storage_tree ===
    "7a12912290a07cae2fa8098e3e04e40c8c254317" &&
    manifest.accepted_source.source_only_review_passed === true &&
    manifest.accepted_source.runtime_accepted === false &&
    manifest.accepted_source.preserve_in_later_child_tree === true,
  "Accepted source boundary changed.",
);

for (const path of [
  "history_clean_seed.tree",
  "history_clean_seed.root_commit",
  "history_clean_seed.remote_main_commit",
  "history_clean_seed.remote_main_tree",
  "governance.codeowners.team_slug",
  "governance.github_plan.selected",
  "governance.github_plan.monthly_cost",
  "governance.protected_main.ruleset_id",
  "later_source_child.parent_commit",
  "later_source_child.commit",
  "later_source_child.tree",
  "later_source_child.accepted_source_parity_manifest_sha256",
  "later_source_child.draft_pull_request",
]) {
  assert(valueAt(manifest, path) === null, `Placeholder must remain null: ${path}`);
}

for (const path of [
  "history_clean_seed.review_passed",
  "history_clean_seed.first_push_authorized",
  "governance.codeowners.approved",
  "governance.github_plan.approved",
  "governance.github_plan.private_protection_capability_verified",
  "governance.protected_main.active",
  "governance.protected_main.required_checks_verified",
  "governance.protected_main.codeowners_review_required",
  "later_source_child.exact_head_ci_passed",
  "later_source_child.independent_review_passed",
  "legal.qualified_counsel_approved",
  "legal.corresponding_source_offer_approved",
  "legal.content_addressed_offer_verified",
  "legal.public_name_exception_approved",
  "remote_mutation.repository_visibility_change_authorized",
  "remote_mutation.plan_change_authorized",
  "remote_mutation.ruleset_change_authorized",
  "remote_mutation.environment_creation_authorized",
  "remote_mutation.secret_creation_authorized",
  "remote_mutation.variable_creation_authorized",
  "remote_mutation.package_publication_authorized",
  "remote_mutation.push_authorized",
  "remote_mutation.pull_request_authorized",
  "remote_mutation.merge_authorized",
  "activation.candidate_publication_enabled",
  "activation.source_cutover_enabled",
  "activation.candidate_publication_ready",
  "activation.source_offer_ready",
  "activation.ownership_cutover_ready",
  "activation.provider_binding_ready",
  "activation.backup_restore_ready",
  "activation.workstation_off_verified",
  "activation.runtime_ready",
  "activation.deployment_authorized",
  "activation.production_active",
]) {
  assert(valueAt(manifest, path) === false, `Gate must remain false: ${path}`);
}

const environmentExample = readFileSync(
  join(repositoryRoot, ".env.example"),
  "utf8",
);
assert(
  environmentExample ===
    "# Governance seed only. These fail-closed markers are not runtime settings.\n" +
      "SOCIAL_CANDIDATE_PUBLICATION_ENABLED=false\n" +
      "SOCIAL_SOURCE_CUTOVER_ENABLED=false\n",
  "The placeholder environment example must remain exact and fail-closed.",
);

const workflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "validate-social.yml"),
  "utf8",
);
assert(
  /^permissions:\n  contents: read$/mu.test(workflow),
  "Workflow permissions must be contents read only.",
);
for (const forbidden of [
  /pull_request_target\s*:/u,
  /permissions:[\s\S]*\b(?:contents|packages|pull-requests|id-token):\s*write\b/u,
  /\benvironment\s*:/u,
  /\bsecrets\s*:/u,
  /\bgit\s+push\b/u,
  /\bdocker\s+push\b/u,
]) {
  assert(!forbidden.test(workflow), "Workflow contains a forbidden privileged path.");
}
const actionReferences = [
  ...workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gmu),
].map((match) => match[1]);
assert(
  actionReferences.length === 2 &&
    actionReferences.every((reference) => /@[0-9a-f]{40}$/u.test(reference)),
  "Every action must use an exact full commit SHA.",
);
assert(
  workflow.includes("persist-credentials: false") &&
    workflow.includes("fetch-depth: 0"),
  "Checkout must be full-history and must not persist credentials.",
);

const packageJson = JSON.parse(
  readFileSync(join(repositoryRoot, "package.json"), "utf8"),
);
assert(packageJson.private === true, "Package must remain private.");
assert(
  packageJson.engines.node === "22.23.2" &&
    packageJson.engines.npm === "10.9.8",
  "Governance toolchain pin changed.",
);
assert(
  packageJson.scripts["check:history:required"] ===
    "node scripts/check-history-clean.mjs --require-history" &&
    workflow.includes("npm run check:history:required"),
  "CI must invoke the explicit required-history script.",
);
assert(
  packageJson.dependencies === undefined &&
    packageJson.devDependencies === undefined,
  "Governance seed must remain dependency-free.",
);

console.log(`Governance seed contract passed for ${inventory.length} allowlisted files.`);
