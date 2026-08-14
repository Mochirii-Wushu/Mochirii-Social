import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";

const repositoryRoot = process.cwd();
const allowedFlags = new Set(["--require-history"]);
const flags = new Set(process.argv.slice(2));
if (
  flags.size !== process.argv.slice(2).length ||
  [...flags].some((flag) => !allowedFlags.has(flag))
) {
  throw new Error("Unexpected or duplicate history-check flag.");
}

const seedPaths = [
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

function git(args, { allowedStatuses = [0], encoding = "utf8" } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`History command failed safely: git ${args[0]} (exit ${result.status})`);
  }
  return result;
}

function assertNoRepositoryIndirection() {
  const replaceRefs = git(["replace", "-l"]).stdout.trim();
  if (replaceRefs) {
    throw new Error("Git replace refs are forbidden in the bootstrap history.");
  }
  for (const gitPath of ["info/grafts", "shallow", "objects/info/alternates"]) {
    const absolutePath = git([
      "rev-parse",
      "--path-format=absolute",
      "--git-path",
      gitPath,
    ]).stdout.trim();
    if (existsSync(absolutePath) && statSync(absolutePath).size > 0) {
      throw new Error(`Git history indirection is forbidden: ${gitPath}`);
    }
  }
}

assertNoRepositoryIndirection();

const historyLines = git(["rev-list", "--all", "--parents"]).stdout
  .trim()
  .split(/\r?\n/u)
  .filter(Boolean);

if (historyLines.length === 0) {
  if (flags.has("--require-history")) {
    throw new Error("A reviewed root commit is required but no history exists.");
  }
  console.log("History-clean candidate passed with no commit object.");
  process.exit(0);
}

const parsed = historyLines.map((line) => line.split(/\s+/u));
if (parsed.some((fields) => fields.length > 2)) {
  throw new Error("Merge commits are forbidden in the Social bootstrap ancestry.");
}
const roots = parsed.filter((fields) => fields.length === 1).map(([commit]) => commit);
if (roots.length !== 1) {
  throw new Error("Bootstrap ancestry must contain exactly one root commit.");
}
const rootCommit = roots[0];

for (const [commit] of parsed) {
  const result = git(
    ["merge-base", "--is-ancestor", rootCommit, commit],
    { allowedStatuses: [0, 1] },
  );
  if (result.status !== 0) {
    throw new Error("Every reachable commit must descend from the one clean root.");
  }
}

const rootPaths = git([
  "ls-tree",
  "-r",
  "--name-only",
  "-z",
  rootCommit,
], { encoding: null }).stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();
if (JSON.stringify(rootPaths) !== JSON.stringify(seedPaths)) {
  throw new Error("The root commit tree differs from the governance seed allowlist.");
}

const contentChecks = [
  {
    name: "private key",
    pattern: "-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
  },
  {
    name: "GitHub token",
    pattern: "github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}",
  },
  { name: "cloud access key", pattern: "AKIA[0-9A-Z]{16}" },
  {
    name: "collaboration token",
    pattern: "xox[baprs]-[A-Za-z0-9-]{10,}",
  },
  { name: "live payment key", pattern: "sk_live_[A-Za-z0-9]{16,}" },
  { name: "local credential boundary", pattern: "Mochi" + " Creds" },
  {
    name: "local workstation path",
    pattern: "[A-Za-z]:" + "\\\\" + "Github Repo",
  },
];

const commits = parsed.map(([commit]) => commit);
for (const commit of commits) {
  for (const check of contentChecks) {
    const result = git(
      ["grep", "-I", "-l", "-E", "-e", check.pattern, commit, "--"],
      { allowedStatuses: [0, 1] },
    );
    if (result.status === 0 && result.stdout.trim()) {
      const paths = result.stdout
        .trim()
        .split(/\r?\n/u)
        .map((line) => line.slice(line.indexOf(":") + 1))
        .join(", ");
      throw new Error(`History contains a redacted ${check.name} finding: ${paths}`);
    }
  }
}

console.log(
  `History-clean ancestry passed: ${commits.length} commit(s), one governance root, no merges.`,
);
