import { pathToFileURL } from "node:url";
import {
  assertInsideWorkTree,
  assertNoProtectedUrlRewrite,
  git,
  localConfigValues,
  parseCommonArguments,
  policy,
  remoteNames,
} from "./remote-policy.mjs";

function assertExact(values, expected, message) {
  if (
    values.length !== expected.length ||
    values.some((value, index) => value !== expected[index])
  ) {
    throw new Error(message);
  }
}
export function verifyRemotePolicy(
  repositoryRoot,
  {
    requireReachable = false,
    requirePinnedHead = false,
    proveUpstreamPushDisabled = false,
  } = {},
) {
  assertInsideWorkTree(repositoryRoot);
  assertExact(
    remoteNames(repositoryRoot),
    ["origin", "upstream"],
    "Remote inventory must contain exactly origin and upstream.",
  );

  assertExact(
    localConfigValues(repositoryRoot, "remote.origin.url"),
    [policy.originUrl],
    "Origin fetch URL is not canonical.",
  );
  const explicitOriginPush = localConfigValues(
    repositoryRoot,
    "remote.origin.pushurl",
  );
  if (
    explicitOriginPush.length > 1 ||
    (explicitOriginPush.length === 1 &&
      explicitOriginPush[0] !== policy.originUrl)
  ) {
    throw new Error("Origin push URL is not canonical.");
  }

  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.url"),
    [policy.upstreamUrl],
    "Upstream fetch URL is not the approved official repository.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.pushurl"),
    [policy.upstreamPushSentinel],
    "Upstream must have exactly one inert push URL.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.fetch"),
    [policy.upstreamFetchSpec],
    "Upstream fetch must be bounded to official dev.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.tagOpt"),
    ["--no-tags"],
    "Upstream must disable automatic tag following.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.pushDefault"),
    ["origin"],
    "Push default must be origin.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "pull.ff"),
    ["only"],
    "Pull policy must be fast-forward-only.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.push"),
    [],
    "Upstream push refspecs are forbidden.",
  );
  assertExact(
    localConfigValues(repositoryRoot, "remote.upstream.mirror"),
    [],
    "Upstream mirror mode is forbidden.",
  );

  assertNoProtectedUrlRewrite(repositoryRoot);

  const branchRemotes = git(
    repositoryRoot,
    ["config", "--local", "--get-regexp", "^branch\\..*\\.remote$"],
    { allowedStatuses: [0, 1] },
  );
  if (
    branchRemotes.status === 0 &&
    branchRemotes.stdout
      .split(/\r?\n/u)
      .filter(Boolean)
      .some((line) => /\s+upstream\s*$/u.test(line))
  ) {
    throw new Error("No branch may track upstream.");
  }

  const effectiveOriginFetch = git(repositoryRoot, [
    "remote",
    "get-url",
    "origin",
  ]).stdout.trim();
  const effectiveOriginPush = git(repositoryRoot, [
    "remote",
    "get-url",
    "--push",
    "origin",
  ]).stdout.trim();
  const effectiveUpstreamFetch = git(repositoryRoot, [
    "remote",
    "get-url",
    "upstream",
  ]).stdout.trim();
  const effectiveUpstreamPush = git(repositoryRoot, [
    "remote",
    "get-url",
    "--push",
    "upstream",
  ]).stdout.trim();
  if (
    effectiveOriginFetch !== policy.originUrl ||
    effectiveOriginPush !== policy.originUrl ||
    effectiveUpstreamFetch !== policy.upstreamUrl ||
    effectiveUpstreamPush !== policy.upstreamPushSentinel
  ) {
    throw new Error("An effective remote URL differs from the reviewed policy.");
  }

  if (requirePinnedHead && !requireReachable) {
    throw new Error("--require-pinned-head also requires --require-reachable.");
  }
  if (requireReachable) {
    const lines = git(repositoryRoot, [
      "ls-remote",
      "--exit-code",
      "upstream",
      policy.upstreamRef,
    ]).stdout
      .trim()
      .split(/\r?\n/u)
      .filter(Boolean);
    if (lines.length !== 1) {
      throw new Error("Official upstream dev did not resolve exactly once.");
    }
    const match = /^([0-9a-f]{40})\s+refs\/heads\/dev$/u.exec(lines[0]);
    if (!match) {
      throw new Error("Official upstream dev returned an invalid reference.");
    }
    if (requirePinnedHead && match[1] !== policy.pinnedUpstreamCommit) {
      throw new Error("Official upstream dev moved after the reviewed pin.");
    }
  }

  if (proveUpstreamPushDisabled) {
    git(repositoryRoot, ["rev-parse", "--verify", "HEAD"]);
    const result = git(
      repositoryRoot,
      [
        "push",
        "--dry-run",
        "upstream",
        "HEAD:refs/heads/codex-readonly-proof",
      ],
      { allowedStatuses: [1, 128] },
    );
    if (result.status === 0) {
      throw new Error("The inert upstream push proof unexpectedly succeeded.");
    }
    const output = `${result.stdout}\n${result.stderr}`;
    if (!/(?:remote helper 'disabled' aborted session|remote-disabled|disabled:\/\/)/iu.test(output)) {
      throw new Error("The upstream dry-run failed without proving the inert transport.");
    }
  }

  return true;
}

function main() {
  const { repositoryRoot, flags } = parseCommonArguments(process.argv.slice(2));
  const allowed = new Set([
    "--require-reachable",
    "--require-pinned-head",
    "--prove-upstream-push-disabled",
  ]);
  if ([...flags].some((flag) => !allowed.has(flag))) {
    throw new Error("Unexpected verifier flag.");
  }
  verifyRemotePolicy(repositoryRoot, {
    requireReachable: flags.has("--require-reachable"),
    requirePinnedHead: flags.has("--require-pinned-head"),
    proveUpstreamPushDisabled: flags.has("--prove-upstream-push-disabled"),
  });
  console.log("Canonical Social remote policy passed.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Remote verification failed.");
    process.exitCode = 1;
  }
}
