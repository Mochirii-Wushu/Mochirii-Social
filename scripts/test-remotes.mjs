import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { git, policy } from "./remote-policy.mjs";

const scriptsDirectory = fileURLToPath(new URL(".", import.meta.url));
const configureScript = join(scriptsDirectory, "configure-remotes.mjs");
const verifyScript = join(scriptsDirectory, "verify-remotes.mjs");
const temporaryBase = resolve(tmpdir());
const temporaryRoot = mkdtempSync(join(temporaryBase, "mochirii-social-remotes-"));
let assertions = 0;

function runNode(script, repositoryRoot, args = [], allowedStatuses = [0]) {
  const result = spawnSync(
    process.execPath,
    [script, "--repository-root", repositoryRoot, ...args],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`Fixture command failed safely (exit ${result.status}).`);
  }
  return result;
}

function expectFailure(callback, label) {
  const result = callback();
  if (result.status === 0) {
    throw new Error(`Hostile fixture was not rejected: ${label}`);
  }
  assertions += 1;
}

function makeFixture(name, originUrl = policy.originUrl) {
  const repositoryRoot = join(temporaryRoot, name);
  git(temporaryRoot, ["init", "--initial-branch=main", repositoryRoot]);
  git(repositoryRoot, ["config", "--local", "core.autocrlf", "false"]);
  writeFileSync(join(repositoryRoot, "fixture.txt"), "isolated fixture\n", {
    encoding: "utf8",
  });
  git(repositoryRoot, ["add", "fixture.txt"]);
  git(repositoryRoot, [
    "-c",
    "user.name=Mochirii Tests",
    "-c",
    "user.email=tests@invalid.example",
    "commit",
    "-m",
    "fixture",
  ]);
  git(repositoryRoot, ["remote", "add", "origin", originUrl]);
  return repositoryRoot;
}

try {
  const fixture = makeFixture("canonical");

  expectFailure(
    () => runNode(configureScript, fixture, [], [0, 1]),
    "configure without explicit apply",
  );

  runNode(configureScript, fixture, ["--apply"]);
  runNode(configureScript, fixture, ["--apply"]);
  runNode(verifyScript, fixture);
  assertions += 3;

  const checkoutFixture = makeFixture(
    "checkout-origin",
    policy.checkoutOriginUrl,
  );
  runNode(configureScript, checkoutFixture, ["--apply"]);
  runNode(verifyScript, checkoutFixture);
  assertions += 2;

  runNode(verifyScript, fixture, ["--prove-upstream-push-disabled"]);
  assertions += 1;

  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.pushurl",
    policy.originUrl,
  ]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "upstream push URL",
  );
  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.pushurl",
    policy.upstreamPushSentinel,
  ]);

  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.fetch",
    "+refs/heads/*:refs/remotes/upstream/*",
  ]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "broad upstream fetch",
  );
  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.fetch",
    policy.upstreamFetchSpec,
  ]);

  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.tagOpt",
    "--tags",
  ]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "automatic upstream tags",
  );
  git(fixture, [
    "config",
    "--local",
    "--replace-all",
    "remote.upstream.tagOpt",
    "--no-tags",
  ]);

  git(fixture, ["config", "--local", "remote.pushDefault", "upstream"]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "upstream push default",
  );
  git(fixture, ["config", "--local", "remote.pushDefault", "origin"]);

  git(fixture, ["config", "--local", "pull.ff", "false"]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "non-fast-forward pull",
  );
  git(fixture, ["config", "--local", "pull.ff", "only"]);

  git(fixture, ["config", "--local", "branch.main.remote", "upstream"]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "branch tracking upstream",
  );
  git(fixture, ["config", "--local", "--unset-all", "branch.main.remote"]);

  git(fixture, [
    "config",
    "--local",
    "url.https://example.invalid/.insteadOf",
    "disabled://",
  ]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "protected URL rewrite",
  );
  git(fixture, [
    "config",
    "--local",
    "--unset-all",
    "url.https://example.invalid/.insteadOf",
  ]);

  git(fixture, ["remote", "add", "unexpected", "https://example.invalid/repo"]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "unexpected remote",
  );
  git(fixture, ["remote", "remove", "unexpected"]);

  git(fixture, ["remote", "set-url", "origin", "https://example.invalid/repo"]);
  expectFailure(
    () => runNode(verifyScript, fixture, [], [0, 1]),
    "noncanonical origin",
  );
  git(fixture, ["remote", "set-url", "origin", policy.originUrl]);

  const hostileExisting = makeFixture("hostile-existing-upstream");
  git(hostileExisting, [
    "remote",
    "add",
    "upstream",
    "https://example.invalid/upstream",
  ]);
  const before = git(hostileExisting, ["config", "--local", "--list"]).stdout;
  expectFailure(
    () => runNode(configureScript, hostileExisting, ["--apply"], [0, 1]),
    "unexpected existing upstream",
  );
  const after = git(hostileExisting, ["config", "--local", "--list"]).stdout;
  if (after !== before) {
    throw new Error("Rejected configuration changed the fixture Git config.");
  }
  assertions += 1;

  runNode(verifyScript, fixture);
  assertions += 1;
  console.log(`Remote policy fixtures passed: ${assertions} assertions.`);
} finally {
  const resolvedRoot = resolve(temporaryRoot);
  const expectedPrefix = temporaryBase.endsWith(sep)
    ? temporaryBase
    : `${temporaryBase}${sep}`;
  if (!resolvedRoot.startsWith(expectedPrefix)) {
    throw new Error("Refusing to clean a fixture outside the system temporary directory.");
  }
  rmSync(resolvedRoot, { recursive: true, force: false });
}
