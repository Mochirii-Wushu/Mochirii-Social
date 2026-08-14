import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();
const contract = JSON.parse(
  readFileSync("docs/operations/source-equivalence.v1.json", "utf8"),
);
const expectedCount = contract.source.file_count;
const prefix = "services/social/";

function fail(message) {
  throw new Error(message);
}

function git(args, { encoding = null, input, allowedStatuses = [0] } = {}) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding,
    input,
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowedStatuses.includes(result.status)) {
    fail(`Source-equivalence Git command failed safely: git ${args[0]}`);
  }
  return result;
}

function parseManifest(file) {
  const entries = new Map();
  const headers = new Map();
  for (const line of readFileSync(file, "utf8").replaceAll("\r\n", "\n").split("\n")) {
    if (!line) continue;
    if (line.startsWith("# ")) {
      const separator = line.indexOf("=");
      if (separator > 2) {
        headers.set(line.slice(2, separator), line.slice(separator + 1));
      }
      continue;
    }
    const match = /^([0-9a-f]{64})  (100644|100755)  ([^\s]+)$/u.exec(line);
    if (!match || entries.has(match[3])) {
      fail(`Malformed or duplicate manifest entry in ${file}.`);
    }
    entries.set(match[3], { sha256: match[1], mode: match[2] });
  }
  return { entries, headers };
}

function parseIndex() {
  return git(["ls-files", "-s", "-z", "--", "services/social"]).stdout
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/u.exec(entry);
      if (!match) fail("Malformed destination index entry.");
      const fullPath = match[3].replaceAll("\\", "/");
      if (!fullPath.startsWith(prefix)) fail("Destination path escaped services/social.");
      return { mode: match[1], oid: match[2], path: fullPath.slice(prefix.length) };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function hashIndex(entries) {
  const unique = [...new Set(entries.map((entry) => entry.oid))];
  const output = git(
    ["cat-file", "--batch"],
    { input: Buffer.from(`${unique.join("\n")}\n`, "utf8") },
  ).stdout;
  const hashes = new Map();
  let offset = 0;
  for (const oid of unique) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) fail("Missing Git batch header.");
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/u.exec(
      output.subarray(offset, newline).toString("utf8"),
    );
    if (!match || match[1] !== oid) fail("Unexpected Git batch header.");
    const size = Number(match[2]);
    const start = newline + 1;
    const end = start + size;
    if (!Number.isSafeInteger(size) || output[end] !== 0x0a) {
      fail("Malformed Git batch payload.");
    }
    hashes.set(
      oid,
      createHash("sha256").update(output.subarray(start, end)).digest("hex"),
    );
    offset = end + 1;
  }
  if (offset !== output.length) fail("Unexpected trailing Git batch output.");
  return new Map(
    entries.map((entry) => [
      entry.path,
      { mode: entry.mode, sha256: hashes.get(entry.oid) },
    ]),
  );
}

if (
  contract.schema_version !== 1 ||
  contract.source.commit !== "ef5675575aeea6cb41def256d0a889f60f963ff8" ||
  contract.source.subtree !== "d34a61164a37a5b9c476120b03058e6a9836fc58" ||
  contract.destination.path !== "services/social"
) {
  fail("Source-equivalence contract identity is invalid.");
}

const source = parseManifest(
  "docs/operations/incumbent-website-social.sha256",
);
const imported = parseManifest("docs/operations/imported-social.sha256");
const indexEntries = parseIndex();
const actual = hashIndex(indexEntries);

for (const [manifestName, manifest] of [
  ["incumbent", source],
  ["imported", imported],
]) {
  if (
    manifest.entries.size !== expectedCount ||
    manifest.headers.get("source_commit") !== contract.source.commit ||
    manifest.headers.get("source_tree") !== contract.source.subtree ||
    manifest.headers.get("file_count") !== String(expectedCount)
  ) {
    fail(`${manifestName} manifest identity or count is invalid.`);
  }
}
if (actual.size !== expectedCount) fail("Destination index count is invalid.");

const sourcePaths = [...source.entries.keys()].sort();
const importedPaths = [...imported.entries.keys()].sort();
const actualPaths = [...actual.keys()].sort();
if (
  JSON.stringify(sourcePaths) !== JSON.stringify(importedPaths) ||
  JSON.stringify(sourcePaths) !== JSON.stringify(actualPaths)
) {
  fail("Source, imported, and index path inventories differ.");
}

for (const filePath of sourcePaths) {
  const recorded = imported.entries.get(filePath);
  const current = actual.get(filePath);
  if (
    recorded.mode !== current.mode ||
    recorded.sha256 !== current.sha256
  ) {
    fail(`Imported manifest drifted from the Git index: ${filePath}`);
  }
}

const allowed = [...contract.allowed_transition_paths].sort();
const differences = sourcePaths
  .filter((filePath) => {
    const before = source.entries.get(filePath);
    const after = imported.entries.get(filePath);
    if (before.mode !== after.mode) {
      fail(`Git mode changed during repository transition: ${filePath}`);
    }
    return before.sha256 !== after.sha256;
  })
  .sort();
if (JSON.stringify(differences) !== JSON.stringify(allowed)) {
  fail(
    `Actual transition paths do not exactly equal the reviewed allowlist.\n` +
      `expected=${JSON.stringify(allowed)}\nactual=${JSON.stringify(differences)}`,
  );
}

const worktreeDiff = git(
  ["diff", "--quiet", "--", "services/social"],
  { allowedStatuses: [0, 1] },
);
if (worktreeDiff.status !== 0) {
  fail("services/social has unstaged bytes outside the frozen candidate index.");
}
const untracked = git(
  ["ls-files", "--others", "--exclude-standard", "--", "services/social"],
  { encoding: "utf8" },
).stdout.trim();
if (untracked) fail("services/social contains untracked candidate paths.");

console.log(
  `Source equivalence passed: ${expectedCount - allowed.length} exact blobs, ` +
    `${allowed.length} reviewed repository-transition blobs, and no mode drift.`,
);
