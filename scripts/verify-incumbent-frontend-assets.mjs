import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import process from "node:process";

const applicationPrefix = "services/social/";
const publicPrefix = `${applicationPrefix}public/`;
const expectedApplicationFileCount = 2630;
const expectedLegacyInputCount = 228;
const expectedConvertedInputCount = 225;
const expectedPublicFileCount = 446;
const validationRounds = 2;

function fail(message) {
  throw new Error(message);
}

function gitOutput(argumentsList, options = {}) {
  return execFileSync("git", argumentsList, {
    cwd: repositoryRoot,
    encoding: Object.hasOwn(options, "encoding") ? options.encoding : "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
}

const repositoryRoot = resolve(
  execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim(),
);
const canonicalApplicationRoot = join(repositoryRoot, "services", "social");

function repositoryPathToLocal(repoPath) {
  return join(repositoryRoot, ...repoPath.split("/"));
}

function applicationPathToLocal(root, repoPath) {
  return join(root, ...repoPath.slice(applicationPrefix.length).split("/"));
}

function assertCanonicalApplicationClean() {
  const tracked = spawnSync(
    "git",
    ["diff", "--quiet", "--", "services/social"],
    { cwd: repositoryRoot, stdio: "inherit" },
  );
  if (tracked.status !== 0) {
    fail("Tracked incumbent Social files changed before or during asset verification.");
  }

  const untrackedPublic = gitOutput([
    "ls-files",
    "--others",
    "--exclude-standard",
    "--",
    "services/social/public",
  ]).trim();
  if (untrackedPublic) {
    fail(`Untracked canonical public assets exist:\n${untrackedPublic}`);
  }
}

function copyTrackedApplication(tempApplicationRoot, trackedRepoPaths) {
  for (const repoPath of trackedRepoPaths) {
    const source = repositoryPathToLocal(repoPath);
    const destination = applicationPathToLocal(tempApplicationRoot, repoPath);
    const sourceStat = lstatSync(source);
    if (!sourceStat.isFile()) {
      fail(`Unexpected non-file in incumbent application inventory: ${repoPath}`);
    }
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    chmodSync(destination, sourceStat.mode & 0o777);
  }
}

function copyPublicSeed(tempApplicationRoot, publicRepoPaths) {
  const publicRoot = join(tempApplicationRoot, "public");
  rmSync(publicRoot, { recursive: true, force: true });
  for (const repoPath of publicRepoPaths) {
    const source = repositoryPathToLocal(repoPath);
    const destination = applicationPathToLocal(tempApplicationRoot, repoPath);
    const sourceStat = lstatSync(source);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    chmodSync(destination, sourceStat.mode & 0o777);
  }
}

function legacyCheckoutBytes(originalBytes, repoPath) {
  const originalText = originalBytes.toString("utf8");
  if (!Buffer.from(originalText, "utf8").equals(originalBytes)) {
    fail(`Legacy frontend input is not canonical UTF-8: ${repoPath}`);
  }
  const lfText = originalText.replace(/\r\n/gu, "\n");
  if (lfText.includes("\r")) {
    fail(`Legacy frontend input contains an unsupported lone CR: ${repoPath}`);
  }
  return Buffer.from(lfText.replace(/\n/gu, "\r\n"), "utf8");
}

function recreateLegacyCheckoutInputs(tempApplicationRoot, legacyRepoPaths) {
  let convertedCount = 0;
  for (const repoPath of legacyRepoPaths) {
    const file = applicationPathToLocal(tempApplicationRoot, repoPath);
    const originalBytes = readFileSync(file);
    const legacyBytes = legacyCheckoutBytes(originalBytes, repoPath);
    if (!legacyBytes.equals(originalBytes)) {
      writeFileSync(file, legacyBytes);
      convertedCount += 1;
    }
  }
  if (convertedCount !== expectedConvertedInputCount) {
    fail(
      `Legacy frontend conversion inventory changed: expected ${expectedConvertedInputCount}, got ${convertedCount}.`,
    );
  }
}

function runNpm(tempApplicationRoot, argumentsList, label) {
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCommand, argumentsList, {
    cwd: tempApplicationRoot,
    env: process.env,
    shell: process.platform === "win32",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    fail(`${label} failed${result.signal ? ` with signal ${result.signal}` : ""}.`);
  }
}

function installLockedDependencies(tempApplicationRoot) {
  runNpm(
    tempApplicationRoot,
    ["ci", "--offline", "--no-audit", "--no-fund"],
    "Offline locked dependency installation",
  );
  const installedRoot = join(tempApplicationRoot, "node_modules");
  if (!lstatSync(installedRoot).isDirectory()) {
    fail("Disposable node_modules is not a physical directory.");
  }
  if (resolve(realpathSync.native(installedRoot)) !== resolve(installedRoot)) {
    fail("Disposable node_modules resolves outside its application directory.");
  }
}

function normalizeGeneratedVendorLicense(tempApplicationRoot) {
  const licensePath = join(
    tempApplicationRoot,
    "public",
    "js",
    "vendor.js.LICENSE.txt",
  );
  const generated = readFileSync(licensePath, "utf8");
  const normalized = generated
    .replace(/\r\n/gu, "\n")
    .replace(/[ \t]+$/gmu, "");
  writeFileSync(licensePath, normalized, "utf8");
}

function listFiles(root, excludedTopLevel = new Set()) {
  const files = [];
  function visit(directory, relativeDirectory = "") {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (!relativeDirectory && excludedTopLevel.has(entry.name)) {
        continue;
      }
      if (entry.isDirectory()) {
        visit(path, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        fail(`Unexpected generated public entry type: ${path}`);
      }
    }
  }
  visit(root);
  return files.sort();
}

function assertNonPublicTrackedBytes(tempApplicationRoot, trackedRepoPaths, legacyRepoPaths) {
  const expectedRelativePaths = trackedRepoPaths
    .filter((repoPath) => !repoPath.startsWith(publicPrefix))
    .map((repoPath) => repoPath.slice(applicationPrefix.length));
  const observedRelativePaths = listFiles(
    tempApplicationRoot,
    new Set(["node_modules", "public"]),
  );
  if (JSON.stringify(observedRelativePaths) !== JSON.stringify(expectedRelativePaths)) {
    fail("Disposable build changed the non-public application file inventory.");
  }

  const legacy = new Set(legacyRepoPaths);
  const mismatches = [];
  for (const repoPath of trackedRepoPaths) {
    if (repoPath.startsWith(publicPrefix)) {
      continue;
    }
    const originalBytes = readFileSync(repositoryPathToLocal(repoPath));
    const expectedBytes = legacy.has(repoPath)
      ? legacyCheckoutBytes(originalBytes, repoPath)
      : originalBytes;
    const observedBytes = readFileSync(
      applicationPathToLocal(tempApplicationRoot, repoPath),
    );
    if (!observedBytes.equals(expectedBytes)) {
      mismatches.push(repoPath.slice(applicationPrefix.length));
    }
  }
  if (mismatches.length) {
    fail(
      `Disposable build changed non-public tracked bytes: ${mismatches.slice(0, 20).join(", ")}.`,
    );
  }
}

function comparePublicTree(tempApplicationRoot, expectedPublicRepoPaths) {
  const generatedPublicRoot = join(tempApplicationRoot, "public");
  const expectedRelativePaths = expectedPublicRepoPaths.map((repoPath) =>
    repoPath.slice(publicPrefix.length),
  );
  const generatedRelativePaths = listFiles(generatedPublicRoot);
  if (JSON.stringify(generatedRelativePaths) !== JSON.stringify(expectedRelativePaths)) {
    const expected = new Set(expectedRelativePaths);
    const generated = new Set(generatedRelativePaths);
    const missing = expectedRelativePaths.filter((path) => !generated.has(path));
    const extra = generatedRelativePaths.filter((path) => !expected.has(path));
    fail(
      `Generated public inventory changed. Missing: ${missing.slice(0, 20).join(", ") || "none"}. Extra: ${extra.slice(0, 20).join(", ") || "none"}.`,
    );
  }

  const digest = createHash("sha256");
  const mismatches = [];
  for (const repoPath of expectedPublicRepoPaths) {
    const relativePath = repoPath.slice(publicPrefix.length);
    const expectedBytes = readFileSync(repositoryPathToLocal(repoPath));
    const generatedBytes = readFileSync(join(generatedPublicRoot, ...relativePath.split("/")));
    if (!generatedBytes.equals(expectedBytes)) {
      mismatches.push(relativePath);
    }
    digest.update(relativePath, "utf8");
    digest.update("\0", "utf8");
    digest.update(generatedBytes);
    digest.update("\0", "utf8");
  }
  if (mismatches.length) {
    fail(
      `Generated public bytes differ from the incumbent assets: ${mismatches.slice(0, 20).join(", ")}.`,
    );
  }
  return digest.digest("hex");
}

assertCanonicalApplicationClean();

const trackedRepoPaths = gitOutput([
  "ls-files",
  "-z",
  "--",
  "services/social",
], { encoding: null })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();
if (trackedRepoPaths.length !== expectedApplicationFileCount) {
  fail(
    `Incumbent application inventory changed: expected ${expectedApplicationFileCount}, got ${trackedRepoPaths.length}.`,
  );
}

const legacyRepoPaths = trackedRepoPaths.filter(
  (repoPath) => repoPath.endsWith(".vue") || repoPath.endsWith(".scss"),
);
if (legacyRepoPaths.length !== expectedLegacyInputCount) {
  fail(
    `Legacy frontend input inventory changed: expected ${expectedLegacyInputCount}, got ${legacyRepoPaths.length}.`,
  );
}
const publicRepoPaths = trackedRepoPaths
  .filter((repoPath) => repoPath.startsWith(publicPrefix))
  .sort();
if (publicRepoPaths.length !== expectedPublicFileCount) {
  fail(
    `Incumbent public inventory changed: expected ${expectedPublicFileCount}, got ${publicRepoPaths.length}.`,
  );
}

const roundDigests = [];
const tempRoot = mkdtempSync(join(tmpdir(), "mochirii-social-assets-"));
const tempApplicationRoot = join(tempRoot, "services", "social");
try {
  const resolvedTempRoot = resolve(tempRoot);
  const resolvedTempBase = `${resolve(tmpdir())}${sep}`;
  if (!resolvedTempRoot.startsWith(resolvedTempBase)) {
    fail(`Unsafe temporary asset-verification path: ${resolvedTempRoot}`);
  }
  copyTrackedApplication(tempApplicationRoot, trackedRepoPaths);
  recreateLegacyCheckoutInputs(tempApplicationRoot, legacyRepoPaths);
  installLockedDependencies(tempApplicationRoot);

  for (let round = 1; round <= validationRounds; round += 1) {
    copyPublicSeed(tempApplicationRoot, publicRepoPaths);
    runNpm(
      tempApplicationRoot,
      ["run", "production"],
      `Incumbent frontend validation build ${round}`,
    );
    normalizeGeneratedVendorLicense(tempApplicationRoot);
    const digest = comparePublicTree(tempApplicationRoot, publicRepoPaths);
    assertNonPublicTrackedBytes(
      tempApplicationRoot,
      trackedRepoPaths,
      legacyRepoPaths,
    );
    roundDigests.push(digest);
    console.log(`Incumbent frontend validation round ${round} matched (${digest}).`);
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
if (new Set(roundDigests).size !== 1) {
  fail("Repeated incumbent frontend validation builds were not byte-identical.");
}

assertCanonicalApplicationClean();
console.log("Incumbent frontend assets reproduced exactly without changing the canonical tree.");
