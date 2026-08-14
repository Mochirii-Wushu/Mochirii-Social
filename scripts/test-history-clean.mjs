import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join, resolve, sep } from "node:path";

const sourceRoot = process.cwd();
if (process.argv.length !== 2) {
  throw new Error("History fixture runner accepts no arguments.");
}
const temporaryBase = resolve(process.env.TEMP ?? process.env.TMP ?? ".");
const temporaryRoot = mkdtempSync(
  join(temporaryBase, "mochirii-social-history-"),
);
let assertions = 0;

function run(command, args, cwd, allowedStatuses = [0]) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(
      `History fixture command failed safely: ${command} (exit ${result.status})`,
    );
  }
  return result;
}

function git(cwd, args, allowedStatuses = [0]) {
  return run("git", args, cwd, allowedStatuses);
}

function copyIndexedSeed(destination) {
  const prefix = `${resolve(destination).replaceAll("\\", "/")}/`;
  git(sourceRoot, ["checkout-index", "--all", `--prefix=${prefix}`]);
}

function initializeFixture(name, mutateBeforeCommit) {
  const fixture = join(temporaryRoot, name);
  copyIndexedSeed(fixture);
  if (mutateBeforeCommit) mutateBeforeCommit(fixture);
  git(fixture, ["init", "--initial-branch=main"]);
  git(fixture, ["config", "--local", "core.autocrlf", "false"]);
  git(fixture, ["add", "--all"]);
  git(fixture, [
    "-c",
    "user.name=Mochirii Tests",
    "-c",
    "user.email=tests@invalid.example",
    "commit",
    "-m",
    "fixture root",
  ]);
  return fixture;
}

function runHistoryCheck(fixture, allowedStatuses = [0]) {
  return run(
    process.execPath,
    ["scripts/check-history-clean.mjs", "--require-history"],
    fixture,
    allowedStatuses,
  );
}

function expectRejected(fixture, label) {
  const result = runHistoryCheck(fixture, [0, 1]);
  if (result.status === 0) {
    throw new Error(`History hostile fixture was not rejected: ${label}`);
  }
  assertions += 1;
}

try {
  const linear = initializeFixture("linear");
  runHistoryCheck(linear);
  assertions += 1;

  writeFileSync(join(linear, "child-proof.txt"), "child proof\n", "utf8");
  git(linear, ["add", "child-proof.txt"]);
  git(linear, [
    "-c",
    "user.name=Mochirii Tests",
    "-c",
    "user.email=tests@invalid.example",
    "commit",
    "-m",
    "fixture child",
  ]);
  runHistoryCheck(linear);
  assertions += 1;

  const rootCommit = git(linear, ["rev-list", "--max-parents=0", "HEAD"]).stdout.trim();
  git(linear, ["checkout", "-b", "fixture-merge", rootCommit]);
  writeFileSync(join(linear, "merge-proof.txt"), "merge proof\n", "utf8");
  git(linear, ["add", "merge-proof.txt"]);
  git(linear, [
    "-c",
    "user.name=Mochirii Tests",
    "-c",
    "user.email=tests@invalid.example",
    "commit",
    "-m",
    "fixture merge side",
  ]);
  git(linear, ["checkout", "main"]);
  git(linear, [
    "-c",
    "user.name=Mochirii Tests",
    "-c",
    "user.email=tests@invalid.example",
    "merge",
    "--no-ff",
    "fixture-merge",
    "-m",
    "fixture merge",
  ]);
  expectRejected(linear, "merge ancestry");

  const extraRoot = initializeFixture("extra-root", (fixture) => {
    writeFileSync(join(fixture, "unexpected.txt"), "unexpected\n", "utf8");
  });
  expectRejected(extraRoot, "extra root path");

  const sensitiveHistory = initializeFixture("sensitive-history", (fixture) => {
    appendFileSync(
      join(fixture, "README.md"),
      `\n${"Mochi" + " Creds"}\n`,
      "utf8",
    );
  });
  expectRejected(sensitiveHistory, "historical boundary marker");

  console.log(`History-clean fixtures passed: ${assertions} assertions.`);
} finally {
  const resolvedRoot = resolve(temporaryRoot);
  const expectedPrefix = temporaryBase.endsWith(sep)
    ? temporaryBase
    : `${temporaryBase}${sep}`;
  if (!resolvedRoot.startsWith(expectedPrefix)) {
    throw new Error("Refusing to clean a fixture outside the temporary directory.");
  }
  rmSync(resolvedRoot, { recursive: true, force: false });
}
