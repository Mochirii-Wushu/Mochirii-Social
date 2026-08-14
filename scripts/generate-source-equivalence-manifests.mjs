import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceCommit = "ef5675575aeea6cb41def256d0a889f60f963ff8";
const sourceTree = "d34a61164a37a5b9c476120b03058e6a9836fc58";
const sourcePrefix = "services/social/";
const expectedCount = 2630;

function fail(message) {
  throw new Error(message);
}

function runGit(repository, args, { encoding = null, input } = {}) {
  const result = spawnSync("git", ["-C", repository, ...args], {
    encoding,
    input,
    maxBuffer: 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.status !== 0) {
    fail(`Git object command failed safely: git ${args[0]}`);
  }
  return result.stdout;
}

function parseTree(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf("\t");
      if (separator < 0) fail("Malformed source tree entry.");
      const [mode, type, oid] = entry.slice(0, separator).split(" ");
      const filePath = entry.slice(separator + 1).replaceAll("\\", "/");
      if (type !== "blob" || !/^[0-9a-f]{40}$/u.test(oid)) {
        fail(`Unsupported source object at ${filePath}.`);
      }
      return { mode, oid, path: filePath };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function parseIndex(buffer) {
  return buffer
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/u.exec(entry);
      if (!match) fail("Malformed destination index entry.");
      const fullPath = match[3].replaceAll("\\", "/");
      if (!fullPath.startsWith(sourcePrefix)) {
        fail(`Destination entry escaped services/social: ${fullPath}`);
      }
      return {
        mode: match[1],
        oid: match[2],
        path: fullPath.slice(sourcePrefix.length),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function readBlobs(repository, oids) {
  const unique = [...new Set(oids)];
  const output = runGit(
    repository,
    ["cat-file", "--batch"],
    { input: Buffer.from(`${unique.join("\n")}\n`, "utf8") },
  );
  const blobs = new Map();
  let offset = 0;
  for (const requestedOid of unique) {
    const newline = output.indexOf(0x0a, offset);
    if (newline < 0) fail("Missing Git batch header.");
    const header = output.subarray(offset, newline).toString("utf8");
    const match = /^([0-9a-f]{40}) blob ([0-9]+)$/u.exec(header);
    if (!match || match[1] !== requestedOid) {
      fail("Unexpected Git batch object header.");
    }
    const size = Number(match[2]);
    const start = newline + 1;
    const end = start + size;
    if (!Number.isSafeInteger(size) || output[end] !== 0x0a) {
      fail("Malformed Git batch object payload.");
    }
    blobs.set(
      requestedOid,
      createHash("sha256").update(output.subarray(start, end)).digest("hex"),
    );
    offset = end + 1;
  }
  if (offset !== output.length) fail("Unexpected trailing Git batch output.");
  return blobs;
}

function render(header, entries, hashes) {
  const lines = [
    "# Mochirii Social canonical Git-blob SHA-256 manifest",
    "# format=sha256  git-mode  path",
    ...Object.entries(header).map(([key, value]) => `# ${key}=${value}`),
    ...entries.map(
      (entry) => `${hashes.get(entry.oid)}  ${entry.mode}  ${entry.path}`,
    ),
  ];
  return `${lines.join("\n")}\n`;
}

const args = process.argv.slice(2);
if (
  args.length !== 3 ||
  args[0] !== "--source-repository" ||
  args[2] !== "--write"
) {
  fail(
    "Usage: node scripts/generate-source-equivalence-manifests.mjs " +
      "--source-repository <clean Website clone> --write",
  );
}

const sourceRepository = path.resolve(args[1]);
const resolvedSourceTree = runGit(
  sourceRepository,
  ["rev-parse", `${sourceCommit}:services/social`],
  { encoding: "utf8" },
).trim();
if (resolvedSourceTree !== sourceTree) {
  fail("Source repository does not contain the reviewed incumbent tree.");
}

const sourceEntries = parseTree(
  runGit(sourceRepository, [
    "ls-tree",
    "-r",
    "-z",
    `${sourceCommit}:services/social`,
  ]),
);
const destinationEntries = parseIndex(
  runGit(root, ["ls-files", "-s", "-z", "--", "services/social"]),
);

if (
  sourceEntries.length !== expectedCount ||
  destinationEntries.length !== expectedCount
) {
  fail("Source or destination file count differs from the reviewed inventory.");
}
if (
  sourceEntries.some(
    (entry, index) => entry.path !== destinationEntries[index]?.path,
  )
) {
  fail("Source and destination path inventories differ.");
}

const sourceHashes = readBlobs(
  sourceRepository,
  sourceEntries.map((entry) => entry.oid),
);
const destinationHashes = readBlobs(
  root,
  destinationEntries.map((entry) => entry.oid),
);

writeFileSync(
  path.join(root, "docs", "operations", "incumbent-website-social.sha256"),
  render(
    {
      source_repository: "Mochirii-Wushu/Mochirii-Website",
      source_commit: sourceCommit,
      source_tree: sourceTree,
      file_count: expectedCount,
    },
    sourceEntries,
    sourceHashes,
  ),
  "utf8",
);
writeFileSync(
  path.join(root, "docs", "operations", "imported-social.sha256"),
  render(
    {
      destination_repository: "Mochirii-Wushu/Mochirii-Social",
      source_commit: sourceCommit,
      source_tree: sourceTree,
      file_count: expectedCount,
    },
    destinationEntries,
    destinationHashes,
  ),
  "utf8",
);

console.log(`Wrote canonical SHA-256 manifests for ${expectedCount} files.`);
